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
        const [remote] = ev.streams;
        if (videoRef.current && remote) videoRef.current.srcObject = remote;
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
            setStatus('ended');
            setMessage('The presenter stopped sharing.');
            return;
          }
          if (sig.message_type === 'offer' && sig.payload?.sdp) {
            const pc = makePc();
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              await presentationSendSignal(sess.uuid, {
                message_type: 'answer',
                payload: { type: ans.type, sdp: ans.sdp },
              });
            } catch (_) {
              /* wait for retry / next offer */
            }
          } else if (sig.message_type === 'iceCandidate' && sig.payload && sess.pc) {
            try {
              await sess.pc.addIceCandidate(new RTCIceCandidate(sig.payload));
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
    <div className="relative flex min-h-[100dvh] flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-4 py-4 backdrop-blur">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Live presentation</h1>
          <p className="text-xs text-slate-400">{teacherName ? `Instructor: ${teacherName}` : ' '}· {statusLabel}</p>
        </div>
        <Link
          to="/student/dashboard"
          className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
        >
          Back to dashboard
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          className="aspect-video max-h-[min(75vh,720px)] w-full max-w-5xl rounded-xl bg-black shadow-2xl ring-2 ring-white/10"
        />
        <p className="mt-4 max-w-xl text-center text-sm text-slate-400">{message}</p>
      </div>
    </div>
  );
}
