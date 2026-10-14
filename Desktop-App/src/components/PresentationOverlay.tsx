import { useEffect, useRef, useState } from 'react';
import { Lock, Power, Radio, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import {
  presentationJoin,
  presentationPollSignals,
  presentationSendSignal,
} from '../api/presentations';
import { getDefaultRtcConfiguration } from '../utils/webrtcConfig';

const POLL_MS = 1300;

type PresentationOverlayProps = {
  sessionUuid: string;
  teacherName?: string | null;
  subjectName?: string | null;
};

export default function PresentationOverlay({
  sessionUuid,
  teacherName,
  subjectName,
}: PresentationOverlayProps) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended' | 'error'>('connecting');
  const [statusMessage, setStatusMessage] = useState('Connecting to instructor stream…');
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolume] = useState(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingIceCandidatesRef = useRef<any[]>([]);

  const canQuit =
    typeof window !== 'undefined' && Boolean((window as Window).electronAPI?.quitApp);

  useEffect(() => {
    if (!sessionUuid) return;

    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let teacherUserId: number | null = null;
    let lastSignalId = 0;
    let pollInterval: any = null;

    const closePc = () => {
      if (pc) {
        try {
          pc.close();
        } catch (_) {}
        pc = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const makePc = () => {
      closePc();
      const cfg = getDefaultRtcConfiguration();
      const newPc = new RTCPeerConnection(cfg);
      pc = newPc;

      newPc.ontrack = (ev) => {
        console.log('[Presentation Overlay] ontrack event fired! Tracks:', ev.streams[0]?.getTracks().length);
        const stream = (ev.streams && ev.streams[0]) ? ev.streams[0] : new MediaStream([ev.track]);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          console.log('[Presentation Overlay] Assigned stream to video.srcObject. Attempting play...');
          videoRef.current.play().then(() => {
            console.log('[Presentation Overlay] Video play() succeeded initially.');
          }).catch((err) => {
            console.warn('[Presentation Overlay] Video play() failed, trying muted:', err.message);
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().then(() => {
                console.log('[Presentation Overlay] Video play() succeeded after muting.');
              }).catch((e) => console.error('[Presentation Overlay] Video play() totally failed:', e));
            }
          });
        }
      };

      newPc.oniceconnectionstatechange = () => {
        const state = newPc.iceConnectionState;
        console.log('[Presentation Overlay] ICE state:', state);
        if (state === 'connected' || state === 'completed') {
          setStatus('connected');
          setStatusMessage('');
        } else if (state === 'failed') {
          setStatus('error');
          setStatusMessage('Network stream connection failed. Check firewall / network.');
        } else if (state === 'disconnected') {
          setStatusMessage('Stream disconnected, reconnecting…');
        }
      };

      newPc.onconnectionstatechange = () => {
        const state = newPc.connectionState;
        console.log('[Presentation Overlay] Peer connection state:', state);
        if (state === 'connected') {
          setStatus('connected');
          setStatusMessage('');
        } else if (state === 'failed') {
          setStatus('error');
          setStatusMessage('WebRTC stream connection failed.');
        }
      };

      newPc.onicecandidate = (ev) => {
        if (ev.candidate && sessionUuid && teacherUserId) {
          presentationSendSignal(sessionUuid, {
            message_type: 'iceCandidate',
            recipient_user_id: teacherUserId,
            payload: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
          }).catch(() => {});
        }
      };

      return newPc;
    };

    const initConnection = async () => {
      try {
        setStatus('connecting');
        setStatusMessage('Joining presentation session…');

        const joinRes = await presentationJoin(sessionUuid);
        if (cancelled) return;

        if (!joinRes?.ok) {
          setStatus('error');
          setStatusMessage(joinRes?.message || 'Unable to join instructor presentation.');
          return;
        }

        teacherUserId = joinRes.teacher_user_id ?? null;
        setStatusMessage('Waiting for video stream from instructor…');

        const processSignals = async () => {
          if (cancelled) return;
          try {
            const res = await presentationPollSignals(sessionUuid, lastSignalId);
            if (cancelled) return;

            if (res?.session_status === 'ended') {
              closePc();
              setStatus('ended');
              setStatusMessage('The presentation has ended.');
              return;
            }

            if (!res?.ok || !Array.isArray(res.signals)) return;

            for (const sig of res.signals) {
              lastSignalId = Math.max(lastSignalId, sig.id);

              if (sig.message_type === 'hangup') {
                closePc();
                setStatus('ended');
                setStatusMessage('The instructor stopped screen sharing.');
                return;
              }
              
              // Robustly parse payload
              let payloadObj: any = null;
              if (sig.payload) {
                payloadObj = typeof sig.payload === 'string' ? JSON.parse(sig.payload) : sig.payload;
              }

              if (sig.message_type === 'offer' && payloadObj?.sdp) {
                console.log('[Presentation Overlay] Received SDP Offer from teacher');
                const currentPc = makePc();
                try {
                  // Normalize SDP string to strictly follow WebRTC specs
                  let sdpStr = payloadObj.sdp;
                  sdpStr = sdpStr.replace(/\\r\\n/g, '\r\n'); // Fix any literal \r\n escapes
                  sdpStr = sdpStr.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'); // Enforce CRLF
                  if (!sdpStr.endsWith('\r\n')) sdpStr += '\r\n'; // Ensure trailing newline
                  
                  payloadObj.sdp = sdpStr;

                  await currentPc.setRemoteDescription(new RTCSessionDescription(payloadObj));
                  
                  // Apply any buffered ICE candidates that arrived before the offer
                  const pending = pendingIceCandidatesRef.current || [];
                  if (pending.length) {
                    for (const cand of pending) {
                      try {
                        await currentPc.addIceCandidate(new RTCIceCandidate(cand));
                      } catch (_) {}
                    }
                    pendingIceCandidatesRef.current = [];
                  }

                  const answer = await currentPc.createAnswer();
                  console.log('[Presentation Overlay] Created Answer, setting local description...');
                  await currentPc.setLocalDescription(answer);

                  console.log('[Presentation Overlay] Sending Answer to teacher...');
                  await presentationSendSignal(sessionUuid, {
                    message_type: 'answer',
                    recipient_user_id: teacherUserId,
                    payload: { type: answer.type, sdp: answer.sdp },
                  });
                  console.log('[Presentation Overlay] Answer sent successfully.');
                } catch (err: any) {
                  console.error('Error handling presentation offer:', err);
                  setStatusMessage(`WebRTC Error: ${err?.message}`);
                }
              } else if (sig.message_type === 'iceCandidate' && payloadObj) {
                try {
                  if (!pc || !pc.remoteDescription) {
                    pendingIceCandidatesRef.current.push(payloadObj);
                  } else {
                    await pc.addIceCandidate(new RTCIceCandidate(payloadObj));
                  }
                } catch (iceErr) {
                  console.warn('[Presentation Overlay] Error applying ICE candidate:', iceErr);
                }
              }
            }
          } catch (_) {
            // Keep polling on transient network hiccup
          }
        };

        pollInterval = setInterval(processSignals, POLL_MS);
        void processSignals();
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setStatusMessage(err?.message || 'Failed to connect to presentation.');
        }
      }
    };

    void initConnection();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
      closePc();
      pendingIceCandidatesRef.current = [];
    };
  }, [sessionUuid]);

  // Sync volume & mute with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = volume;
    }
  }, [isMuted, volume]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-slate-950 text-white overflow-hidden select-none"
      style={{
        animation: 'presentation-fade-in 0.3s ease-out forwards',
      }}
    >
      {/* Background ambient aurora glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-rose-600/30 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-red-700/30 blur-3xl" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-slate-900/80 backdrop-blur-md flex-wrap gap-2">
        {/* Left: Live pulsing badge */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-600/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-red-400 shadow-sm animate-pulse">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            LIVE SCREEN SHARE
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-300">
            <Radio className="h-3.5 w-3.5 text-rose-400" />
            <span>Instructor Broadcast Active</span>
          </div>
        </div>

        {/* Center: Title / Subject info */}
        <div className="text-center truncate px-4">
          <h2 className="text-sm sm:text-base font-bold text-white tracking-wide truncate">
            {subjectName ? (
              <>
                <span className="text-rose-400 font-extrabold">{subjectName}</span>
                {teacherName && <span className="text-slate-400 font-normal"> · {teacherName}</span>}
              </>
            ) : (
              <span>Instructor is Sharing Screen {teacherName ? `(${teacherName})` : ''}</span>
            )}
          </h2>
        </div>

        {/* Right: Audio control + Lock notice + Staff Emergency Exit */}
        <div className="flex items-center gap-2.5">
          {/* Volume toggle */}
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1">
            <button
              type="button"
              onClick={() => setIsMuted((prev) => !prev)}
              className="text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-slate-300" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (v > 0 && isMuted) setIsMuted(false);
              }}
              className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          {/* Locked Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Lock className="h-3.5 w-3.5" />
            <span>Restricted View</span>
          </div>

          {/* Staff Emergency Exit App Button */}
          {canQuit && (
            <button
              type="button"
              onClick={() => void (window as Window).electronAPI?.quitApp?.()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-950/70 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-200 hover:bg-red-900 hover:border-red-400 hover:text-white transition-all shadow-sm cursor-pointer"
              title="Close Application (Emergency / Staff)"
            >
              <Power className="h-3.5 w-3.5" />
              <span>Exit App</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Video Presentation Display */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-3 sm:p-5 overflow-hidden">
        <div className="relative w-full h-full max-w-7xl max-h-[82vh] flex items-center justify-center">
          {/* Subtle frame glow */}
          <div
            aria-hidden
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-rose-500/20 via-red-500/10 to-rose-500/20 blur-xl opacity-60 pointer-events-none"
          />

          {/* Video Container with Corner Accents */}
          <div className="relative w-full h-full flex items-center justify-center rounded-2xl border border-white/15 bg-black/90 shadow-2xl overflow-hidden">
            {/* Corner brackets */}
            <div className="absolute top-2 left-2 h-6 w-6 border-t-2 border-l-2 border-rose-500 pointer-events-none z-20" />
            <div className="absolute top-2 right-2 h-6 w-6 border-t-2 border-r-2 border-rose-500 pointer-events-none z-20" />
            <div className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-rose-500 pointer-events-none z-20" />
            <div className="absolute bottom-2 right-2 h-6 w-6 border-b-2 border-r-2 border-rose-500 pointer-events-none z-20" />

            {/* Video stream */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={isMuted}
              onPlaying={() => {
                console.log('[Presentation Overlay] Video onPlaying event fired!');
                setStatus('connected');
                setStatusMessage('');
              }}
              onLoadedMetadata={(e) => {
                console.log('[Presentation Overlay] Video onLoadedMetadata fired, dimensions:', e.currentTarget.videoWidth, 'x', e.currentTarget.videoHeight);
                e.currentTarget.play().catch(() => {
                  e.currentTarget.muted = true;
                  e.currentTarget.play().catch(console.error);
                });
              }}
              className={`w-full h-full object-contain ${
                status === 'connected' ? 'opacity-100' : 'opacity-0'
              } transition-opacity duration-300`}
            />

            {/* Connecting / Status Overlay */}
            {status !== 'connected' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/80 backdrop-blur-sm z-10">
                {status === 'connecting' && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative h-14 w-14">
                      <div className="absolute inset-0 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin" />
                      <Radio className="absolute inset-0 m-auto h-6 w-6 text-rose-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-base font-bold text-white">
                        {statusMessage || 'Establishing secure screen link…'}
                      </p>
                      <p className="text-xs text-slate-400">
                        The instructor's monitor will display here automatically.
                      </p>
                    </div>
                  </div>
                )}

                {status === 'ended' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400">
                      <Radio className="h-6 w-6" />
                    </div>
                    <p className="text-base font-bold text-white">{statusMessage}</p>
                    <p className="text-xs text-slate-400">Returning to normal view shortly…</p>
                  </div>
                )}

                {status === 'error' && (
                  <div className="flex flex-col items-center gap-3 max-w-md">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-900/40 border border-red-500/30 text-red-400">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-red-300">{statusMessage}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Mandatory Warning Strip */}
      <footer className="relative z-10 flex items-center justify-center gap-2 px-4 py-2.5 border-t border-red-900/50 bg-red-950/80 backdrop-blur-md text-xs font-semibold text-red-200">
        <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
        <span className="text-center">
          Screen monitoring is active. You cannot minimize or exit this view while the instructor is presenting.
        </span>
      </footer>

      {/* Animation Style */}
      <style>{`
        @keyframes presentation-fade-in {
          from { opacity: 0; transform: scale(0.99); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
