import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  presentationStart,
  presentationEnd,
  presentationViewers,
  presentationPollSignals,
  presentationSendSignal,
  presentationTeacherActive,
} from '../../api/presentations';
import { listSubjects } from '../../api/client';
import { getDefaultRtcConfiguration } from '../../utils/webrtcConfig';

const POLL_MS = 1300;

export default function TeacherPresentationSection({ subjects: initialSubjects = [] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [sessionUuid, setSessionUuid] = useState(null);
  const [activeSessionData, setActiveSessionData] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [staleBanner, setStaleBanner] = useState(false);
  const [staleUuid, setStaleUuid] = useState(null);

  // Subject selection state
  const [subjectsList, setSubjectsList] = useState(initialSubjects || []);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const negotiatingRef = useRef(new Set());
  const lastSignalIdRef = useRef(0);
  const sessionUuidRef = useRef(null);
  const stopSharingRef = useRef(async () => {});

  useEffect(() => {
    sessionUuidRef.current = sessionUuid;
  }, [sessionUuid]);

  // Load subjects if not passed or empty
  useEffect(() => {
    if (initialSubjects && initialSubjects.length > 0) {
      setSubjectsList(initialSubjects);
      if (!selectedSubjectId && initialSubjects[0]?.id) {
        setSelectedSubjectId(String(initialSubjects[0].id));
      }
      return;
    }

    let mounted = true;
    const fetchTeacherSubjects = async () => {
      setLoadingSubjects(true);
      try {
        const res = await listSubjects();
        if (mounted && res?.ok && Array.isArray(res.data)) {
          setSubjectsList(res.data);
          if (res.data.length > 0 && !selectedSubjectId) {
            setSelectedSubjectId(String(res.data[0].id));
          }
        }
      } catch (_) {
        // Silently fallback
      } finally {
        if (mounted) setLoadingSubjects(false);
      }
    };
    fetchTeacherSubjects();
    return () => {
      mounted = false;
    };
  }, [initialSubjects]);

  const teardownMediaAndPeers = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (_) {}
      });
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    peersRef.current.forEach(({ pc }) => {
      try {
        pc.close();
      } catch (_) {}
    });
    peersRef.current.clear();
    negotiatingRef.current.clear();
    lastSignalIdRef.current = 0;
  }, []);

  const stopSharing = useCallback(async () => {
    const uuid = sessionUuidRef.current;
    teardownMediaAndPeers();
    sessionUuidRef.current = null;
    setLive(false);
    setSessionUuid(null);
    setActiveSessionData(null);
    setViewerCount(0);
    if (uuid) {
      try {
        await presentationEnd(uuid);
      } catch (_) {}
    }
  }, [teardownMediaAndPeers]);

  useEffect(() => {
    stopSharingRef.current = stopSharing;
  }, [stopSharing]);

  /** End orphaned server session without local media (e.g. after refresh). */
  const endStaleServerSession = async (uuid) => {
    try {
      await presentationEnd(uuid);
      setStaleBanner(false);
      setStaleUuid(null);
    } catch (_) {
      /* ignore */
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await presentationTeacherActive();
        if (cancelled || !s?.active || !s.session?.uuid) return;
        setStaleBanner(true);
        setStaleUuid(s.session.uuid);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!live || !sessionUuid) return undefined;

    const uuid = sessionUuid;
    const sendIce = (studentId, candidate) => {
      if (!candidate) return;
      presentationSendSignal(uuid, {
        message_type: 'iceCandidate',
        recipient_user_id: studentId,
        payload: candidate.toJSON ? candidate.toJSON() : candidate,
      }).catch(() => {});
    };

    const ensurePeer = async (studentId, stream) => {
      if (peersRef.current.has(studentId) || negotiatingRef.current.has(studentId)) return;
      negotiatingRef.current.add(studentId);
      let pc = null;
      try {
        const cfg = getDefaultRtcConfiguration();
        pc = new RTCPeerConnection(cfg);
        peersRef.current.set(studentId, { pc, pendingIce: [], remoteSet: false });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (ev) => {
          if (ev.candidate) sendIce(studentId, ev.candidate);
        };
        pc.oniceconnectionstatechange = () => {
          console.log(`[Teacher WebRTC] Student ${studentId} ICE state:`, pc.iceConnectionState);
        };
        pc.onconnectionstatechange = () => {
          console.log(`[Teacher WebRTC] Student ${studentId} Connection state:`, pc.connectionState);
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await presentationSendSignal(uuid, {
          message_type: 'offer',
          recipient_user_id: studentId,
          payload: { type: offer.type, sdp: offer.sdp },
        });
      } catch (err) {
        console.warn(`[WebRTC] Failed to ensure peer for student ${studentId}:`, err);
        if (pc) {
          try {
            pc.close();
          } catch (_e) {}
        }
        peersRef.current.delete(studentId);
      } finally {
        negotiatingRef.current.delete(studentId);
      }
    };

    const processSignals = async () => {
      const res = await presentationPollSignals(uuid, lastSignalIdRef.current);
      if (!res?.ok || !Array.isArray(res.signals)) return;
      for (const sig of res.signals) {
        lastSignalIdRef.current = Math.max(lastSignalIdRef.current, sig.id);
        if (sig.message_type === 'hangup') {
          setError('Presentation ended.');
          await stopSharingRef.current();
          return;
        }
        if (sig.message_type === 'answer') {
          const sid = sig.sender_user_id;
          const entry =
            peersRef.current.get(sid) ||
            peersRef.current.get(Number(sid)) ||
            peersRef.current.get(String(sid));
          
          let payloadObj = sig.payload;
          if (typeof payloadObj === 'string') {
            try {
              payloadObj = JSON.parse(payloadObj);
            } catch (_) {}
          }

          if (!entry?.pc || !payloadObj?.sdp) continue;
          try {
            // Normalize SDP string to strictly follow WebRTC specs
            let sdpStr = payloadObj.sdp;
            sdpStr = typeof sdpStr === 'string' ? sdpStr : JSON.stringify(sdpStr);
            sdpStr = sdpStr.replace(/\\r\\n/g, '\r\n');
            sdpStr = sdpStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
            if (!sdpStr.endsWith('\r\n')) sdpStr += '\r\n';
            payloadObj.sdp = sdpStr;

            await entry.pc.setRemoteDescription(new RTCSessionDescription(payloadObj));
            entry.remoteSet = true;
            // Apply any ICE candidates that arrived before the remote SDP.
            const pending = entry.pendingIce || [];
            if (pending.length) {
              for (const cand of pending) {
                try {
                  await entry.pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              }
              entry.pendingIce = [];
            }
          } catch (err) {
            console.warn(`[Teacher WebRTC] Failed to set remote answer for student ${sid}:`, err);
          }
        } else if (sig.message_type === 'iceCandidate' && sig.payload) {
          const sid = sig.sender_user_id;
          const entry =
            peersRef.current.get(sid) ||
            peersRef.current.get(Number(sid)) ||
            peersRef.current.get(String(sid));

          let candPayload = sig.payload;
          if (typeof candPayload === 'string') {
            try {
              candPayload = JSON.parse(candPayload);
            } catch (_) {}
          }

          if (!entry?.pc || !candPayload) continue;
          try {
            if (!entry.remoteSet || !entry.pc.remoteDescription) {
              entry.pendingIce = entry.pendingIce || [];
              entry.pendingIce.push(candPayload);
              continue;
            }
            await entry.pc.addIceCandidate(new RTCIceCandidate(candPayload));
          } catch (candErr) {
            console.warn(`[Teacher WebRTC] Failed to add ICE candidate for student ${sid}:`, candErr);
          }
        }
      }
      if (res.session_status === 'ended') {
        await stopSharingRef.current();
      }
    };

    const tick = async () => {
      const stream = localStreamRef.current;
      if (!stream) return;
      try {
        const vr = await presentationViewers(uuid);
        if (!vr?.ok) return;
        const ids = Array.isArray(vr.student_ids) ? vr.student_ids : [];
        setViewerCount(ids.length);
        await Promise.all(ids.map((sid) => ensurePeer(sid, stream)));
        await processSignals();
      } catch (_) {
        /* keep polling */
      }
    };

    const id = setInterval(tick, POLL_MS);
    tick();
    return () => clearInterval(id);
  }, [live, sessionUuid]);

  const onStartSharing = async () => {
    setError('');
    setBusy(true);
    setStaleBanner(false);
    let stream = null;
    let uuid = null;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser.');
      }
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const targetSubjId = selectedSubjectId ? parseInt(selectedSubjectId, 10) : null;
      const startRes = await presentationStart(targetSubjId);
      if (!startRes?.ok || !startRes.session?.uuid) {
        throw new Error(startRes?.message || 'Could not start presentation session.');
      }
      uuid = startRes.session.uuid;
      localStreamRef.current = stream;
      const vtrack = stream.getVideoTracks()[0];
      if (vtrack) {
        vtrack.onended = () => {
          stopSharingRef.current();
        };
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      lastSignalIdRef.current = 0;
      sessionUuidRef.current = uuid;
      setActiveSessionData(startRes.session);
      setSessionUuid(uuid);
      setLive(true);
    } catch (e) {
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (_) {}
        });
      }
      if (uuid) {
        try {
          await presentationEnd(uuid);
        } catch (_) {}
      }
      localStreamRef.current = null;
      sessionUuidRef.current = null;
      setError(e?.message || 'Could not start screen sharing.');
      setLive(false);
      setSessionUuid(null);
      setActiveSessionData(null);
    } finally {
      setBusy(false);
    }
  };

  const selectedSubjectObj = subjectsList.find((s) => String(s.id) === String(selectedSubjectId));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/20 bg-white/50 dark:bg-slate-900/40 dark:border-white/10 p-6 shadow-lg backdrop-blur-md">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Live Screen Share Monitoring</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Broadcast your monitor to students' PCs in real-time</p>
            </div>
          </div>
          {live && (
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-400"></span>
              BROADCASTING LIVE
            </div>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          When you start sharing, enrolled students will automatically see your monitor locked fullscreen on their lab PCs. They cannot exit or minimize while the presentation is active.
        </p>

        {staleBanner && !live && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-100 flex items-center justify-between flex-wrap gap-2">
            <span>A presentation was left active on the server. End it before starting a new one, or start sharing to replace it.</span>
            <button
              type="button"
              onClick={() => staleUuid && endStaleServerSession(staleUuid)}
              className="font-semibold text-rose-800 underline dark:text-rose-200 hover:text-rose-900 text-xs px-2 py-1 rounded bg-rose-200/50 dark:bg-rose-800/40"
            >
              End server session
            </button>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Subject Selection Box - Enabled only when not live */}
        {!live ? (
          <div className="mb-6 rounded-xl border border-slate-200/80 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50 p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Select Target Subject / Class:
            </label>
            {loadingSubjects ? (
              <div className="py-3 text-sm text-slate-500">Loading your subjects...</div>
            ) : subjectsList.length === 0 ? (
              <div className="text-sm text-rose-600 dark:text-rose-400 py-2">
                No subjects assigned yet. Students in all your classes will be able to join.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {subjectsList.map((subj) => {
                  const isSelected = String(selectedSubjectId) === String(subj.id);
                  return (
                    <div
                      key={subj.id}
                      onClick={() => setSelectedSubjectId(String(subj.id))}
                      className={`cursor-pointer rounded-xl border p-3 transition-all ${
                        isSelected
                          ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-sm ring-1 ring-rose-500/50'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm">{subj.code || 'SUBJ'}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-400">
                          {subj.course} {subj.section}
                        </span>
                      </div>
                      <p className="text-xs font-medium truncate mt-1 text-slate-600 dark:text-slate-400">
                        {subj.name}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Live Session Info Banner */
          <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Target Class
              </div>
              <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                {activeSessionData?.subject_name || selectedSubjectObj?.name || 'All Enrolled Students'}
                {selectedSubjectObj && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({selectedSubjectObj.course} {selectedSubjectObj.section})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Viewers Connected</div>
                <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400">{viewerCount}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!live ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStartSharing}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 px-6 py-3 text-sm font-bold text-white shadow-lg hover:from-rose-700 hover:to-red-800 hover:shadow-rose-500/25 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {busy ? 'Starting Screen Share…' : 'Start Share Monitoring'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => stopSharing()}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500 bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-red-700 active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              Stop Sharing
            </button>
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Local Preview (Your Screen)
          </p>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="max-h-[min(50vh,380px)] w-full rounded-xl bg-black object-contain shadow-inner ring-1 ring-white/10"
          />
          {!live && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Preview will appear once you select your monitor/window to broadcast.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

