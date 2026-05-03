import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  presentationStart,
  presentationEnd,
  presentationViewers,
  presentationPollSignals,
  presentationSendSignal,
  presentationTeacherActive,
} from '../../api/presentations';
import { getDefaultRtcConfiguration } from '../../utils/webrtcConfig';

const POLL_MS = 1300;

export default function TeacherPresentationSection() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [sessionUuid, setSessionUuid] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [staleBanner, setStaleBanner] = useState(false);

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
        peersRef.current.set(studentId, { pc });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        pc.onicecandidate = (ev) => {
          if (ev.candidate) sendIce(studentId, ev.candidate);
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await presentationSendSignal(uuid, {
          message_type: 'offer',
          recipient_user_id: studentId,
          payload: { type: offer.type, sdp: offer.sdp },
        });
      } catch (_) {
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
          const entry = peersRef.current.get(sid);
          if (!entry?.pc || !sig.payload?.sdp) continue;
          try {
            await entry.pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          } catch (_) {}
        } else if (sig.message_type === 'iceCandidate' && sig.payload) {
          const sid = sig.sender_user_id;
          const entry = peersRef.current.get(sid);
          if (!entry?.pc) continue;
          try {
            await entry.pc.addIceCandidate(new RTCIceCandidate(sig.payload));
          } catch (_) {}
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
      const startRes = await presentationStart();
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-white/20 bg-white/50 dark:bg-slate-900/40 dark:border-white/10 p-6 shadow-lg backdrop-blur-md">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Live screen share</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Share your screen with students enrolled in your subjects. Students open <span className="font-mono text-rose-600 dark:text-rose-400">/student/live-presentation</span> while logged in. Use Chrome or Edge on HTTPS (or localhost).
        </p>

        {staleBanner && !live && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            A presentation was left active on the server. End it before starting a new one, or start sharing to replace it.
            <button
              type="button"
              onClick={async () => {
                const s = await presentationTeacherActive();
                if (s?.active && s.session?.uuid) await endStaleServerSession(s.session.uuid);
              }}
              className="ml-3 font-semibold text-amber-800 underline dark:text-amber-200"
            >
              End server session
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!live ? (
            <button
              type="button"
              disabled={busy}
              onClick={onStartSharing}
              className="rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:from-rose-700 hover:to-red-700 disabled:opacity-60"
            >
              {busy ? 'Starting…' : 'Share screen'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => stopSharing()}
              className="rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Stop sharing
            </button>
          )}
          {live && (
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Viewers connected: <span className="font-semibold text-rose-600 dark:text-rose-400">{viewerCount}</span>
            </span>
          )}
        </div>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Preview (your capture)</p>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="max-h-[min(50vh,360px)] w-full rounded-xl bg-black object-contain shadow-inner ring-1 ring-white/10"
          />
          {!live && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">Preview appears after you grant screen access.</p>
          )}
        </div>
      </div>
    </div>
  );
}
