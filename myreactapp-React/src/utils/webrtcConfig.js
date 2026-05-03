/**
 * Optional JSON in REACT_APP_WEBRTC_ICE_SERVERS e.g.
 * [{"urls":"stun:stun.l.google.com:19302"}]
 */
export function getDefaultRtcConfiguration() {
  let extra = [];
  const raw = process.env.REACT_APP_WEBRTC_ICE_SERVERS;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) extra = parsed;
    } catch (_) {
      /* ignore */
    }
  }
  const defaults = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  return { iceServers: extra.length ? extra : defaults };
}
