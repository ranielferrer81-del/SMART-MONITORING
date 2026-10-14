import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  presentationStudentActive,
  presentationJoin,
  presentationPollSignals,
  presentationSendSignal,
} from '../../api/presentations';
import { getDefaultRtcConfiguration } from '../../utils/webrtcConfig';

const POLL_MS = 1300;

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch (_) {
    return null;
  }
}

export default function StudentLivePresentation() {
  const [status, setStatus] = useState('idle'); // idle | waiting | live | ended | forbidden
  const [message, setMessage] = useState('');
  const [teacherName, setTeacherName] = useState('');

  const videoRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);

  useEffect(() => {
    const user = readStoredUser();
    if (!user || user.role !== 'student') {
      setStatus('forbidden');
      setMessage('Sign in as a student to watch a live presentation.');
      return undefined;
    }

    const sess = { uuid: null, teacherId: null, lastId: 0, pc: null };
    let cancelled = false;

    const closePc = () => {
      if (sess.pc) {
        try {
          sess.pc.close();
        } catch (_) {}
        sess.pc = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const makePc = () => {
      closePc();
      const cfg = getDefaultRtcConfiguration();
      const pc = new RTCPeerConnection(cfg);
      sess.pc = pc;
      pc.ontrack = (ev) => {
        const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && sess.uuid && sess.teacherId) {
          presentationSendSignal(sess.uuid, {
            message_type: 'iceCandidate',
            recipient_user_id: sess.teacherId,
            payload: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
          }).catch(() => {});
        }
      };
      return pc;
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        if (!sess.uuid) {
          const active = await presentationStudentActive();
          if (cancelled) return;
          if (!active?.active || !active.session?.uuid) {
            setStatus('waiting');
            setMessage('When your instructor starts sharing, video will appear here.');
            closePc();
            return;
          }
          sess.uuid = active.session.uuid;
          sess.teacherId = active.session.teacher_user_id;
          sess.lastId = 0;
          setTeacherName(active.session.teacher_name || 'Instructor');

          const j = await presentationJoin(sess.uuid);
          if (cancelled) return;
          if (!j?.ok) {
            setStatus('forbidden');
            setMessage(j?.message || 'You cannot join this presentation.');
            sess.uuid = null;
            sess.teacherId = null;
            closePc();
            return;
          }
          sess.teacherId = j.teacher_user_id;
          setStatus('live');
        }

        const res = await presentationPollSignals(sess.uuid, sess.lastId);
        if (cancelled) return;

        if (res?.session_status === 'ended') {
          closePc();
          sess.uuid = null;
          sess.teacherId = null;
          sess.lastId = 0;
          pendingIceCandidatesRef.current = [];
          setStatus('ended');
          setMessage('The presentation has ended.');
          return;
        }

        if (!res?.ok) return;

        for (const sig of res.signals || []) {
          sess.lastId = Math.max(sess.lastId, sig.id);
          if (sig.message_type === 'hangup') {
            closePc();
            sess.uuid = null;
            sess.teacherId = null;
            sess.lastId = 0;
            pendingIceCandidatesRef.current = [];
            setStatus('ended');
            setMessage('The presenter stopped sharing.');
            return;
          }
          if (sig.message_type === 'offer' && sig.payload?.sdp) {
            const pc = makePc();
            try {
              let sdpStr = sig.payload.sdp;
              sdpStr = typeof sdpStr === 'string' ? sdpStr : JSON.stringify(sdpStr);
              sdpStr = sdpStr.replace(/\\r\\n/g, '\r\n');
              sdpStr = sdpStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
              if (!sdpStr.endsWith('\r\n')) sdpStr += '\r\n';
              sig.payload.sdp = sdpStr;

              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              // Apply any ICE candidates that arrived before the offer.
              const pending = pendingIceCandidatesRef.current || [];
              if (pending.length) {
                for (const cand of pending) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (_) {}
                }
                pendingIceCandidatesRef.current = [];
              }
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              await presentationSendSignal(sess.uuid, {
                message_type: 'answer',
                recipient_user_id: sess.teacherId,
                payload: { type: ans.type, sdp: ans.sdp },
              });
            } catch (_) {
              /* wait for retry / next offer */
            }
          } else if (sig.message_type === 'iceCandidate' && sig.payload) {
            try {
              let candPayload = sig.payload;
              if (typeof candPayload === 'string') {
                try {
                  candPayload = JSON.parse(candPayload);
                } catch (_) {}
              }
              if (!sess.pc || !sess.pc.remoteDescription) {
                pendingIceCandidatesRef.current = pendingIceCandidatesRef.current || [];
                pendingIceCandidatesRef.current.push(candPayload);
                continue;
              }
              await sess.pc.addIceCandidate(new RTCIceCandidate(candPayload));
            } catch (_) {}
          }
        }
      } catch (_) {
        /* continue polling */
      }
    };

    const id = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(id);
      closePc();
        pendingIceCandidatesRef.current = [];
    };
  }, []);

  const statusLabel =
    status === 'live'
      ? 'Watching'
      : status === 'waiting'
        ? 'Waiting'
        : status === 'ended'
          ? 'Ended'
          : status === 'forbidden'
            ? 'Unavailable'
            : '…';

  return (
    <div className="relative flex min-h-[100dvh] min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
      {/* Ambient aurora backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-red-600/20 mix-blend-screen blur-3xl animate-blob" />
        <div className="absolute top-1/4 -right-20 h-[30rem] w-[30rem] rounded-full bg-slate-600/25 mix-blend-screen blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-slate-500/20 mix-blend-screen blur-3xl animate-blob animation-delay-4000" />
        <div className="absolute inset-0 bg-dotgrid opacity-20" />
      </div>

      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 backdrop-blur-2xl px-4 py-4 lg:px-8 lg:py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-rose-500/40 via-rose-500/30 to-rose-500/40 blur-lg opacity-70" aria-hidden />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <svg className="h-5 w-5 text-rose-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-red-700 dark:text-red-400 lg:text-2xl">Live presentation</h1>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              {teacherName ? <>Instructor: <span className="text-rose-300">{teacherName}</span> · </> : null}
              {statusLabel}
            </p>
          </div>
        </div>
        <div className="relative group">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-500 to-rose-500 opacity-0 group-hover:opacity-40 blur transition-opacity duration-300" aria-hidden />
          <Link
            to="/student/dashboard"
            className="relative flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-bold text-slate-100 backdrop-blur-xl shadow-soft hover:bg-white/15 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to dashboard
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 lg:px-8 lg:py-12">
        <div className="relative w-full max-w-6xl">
          {/* Glow halo around video */}
          <div aria-hidden className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-rose-500/20 via-rose-500/20 to-rose-500/20 blur-3xl opacity-70" />
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              controls
              className="relative aspect-video max-h-[min(75vh,720px)] w-full rounded-[1.5rem] bg-black shadow-2xl ring-1 ring-white/20 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
            />
            {/* Corner accents */}
            <div aria-hidden className="absolute -top-2 -left-2 h-8 w-8 rounded-tl-2xl border-t-2 border-l-2 border-red-400/70" />
            <div aria-hidden className="absolute -top-2 -right-2 h-8 w-8 rounded-tr-2xl border-t-2 border-r-2 border-red-400/70" />
            <div aria-hidden className="absolute -bottom-2 -left-2 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-red-400/70" />
            <div aria-hidden className="absolute -bottom-2 -right-2 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-red-400/70" />
          </div>
        </div>
        <p className="relative z-10 mt-6 max-w-2xl text-center text-sm font-medium text-slate-400 lg:text-base">{message}</p>
      </div>
    </div>
  );
}

