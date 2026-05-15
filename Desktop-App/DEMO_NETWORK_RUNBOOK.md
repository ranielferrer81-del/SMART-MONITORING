# Desktop App OTP Demo Runbook

Purpose: a 60-second checklist before a panel/presentation, plus what to do
when OTP fails on the venue Wi-Fi.

## Why it sometimes fails away from home
- The OTP send/resend endpoints contact the email provider (Brevo / Resend / SMTP)
  on the backend, then reply. If the network is slow or flaps mid-request, the
  desktop request can be torn down before the response arrives even though the
  backend already sent the email.
- Public/institutional Wi-Fi can also delay the first DNS+TLS handshake, present
  a captive portal, or block egress to `api.brevo.com` / `api.resend.com`.
- Symptom: app says "could not send" but a code may still arrive minutes later,
  or never if egress is blocked.

## 60-second pre-demo checklist
1. Connect to the demo Wi-Fi at least 2 minutes before logging in. Open a normal
   browser to confirm internet works (handles captive portals).
2. Open the desktop app. The login screen calls `GET /health` once on mount; if
   you see a yellow backend warning banner, the API base URL is wrong or the
   network is blocking it - fix before attempting OTP.
3. Test OTP with a throwaway student account first.
4. If the verification screen shows a fallback code, that means the email
   provider failed but login still works - just type that code.

## When OTP fails during a demo
1. Look at the message carefully:
   - "Connection lost while sending the code..." -> Wi-Fi flap. Wait 5 seconds,
     press Resend. The client will retry once internally.
   - "Resend is taking longer than expected..." -> the request is still flying.
     If a code arrives in the inbox, just type it; no need to resend.
   - "Invalid verification code" -> a real backend rejection. Use Resend.
2. If two resends fail in a row:
   - Confirm the device has internet (open a browser tab if possible).
   - Switch to mobile hotspot if available.
   - As a last resort, ask the panel for a 60-second recovery while you reload
     the app on a known-good network.

## Capturing logs after a failure
1. Open DevTools in the desktop app (Ctrl+Shift+I in dev builds).
2. In the console run:
   ```js
   copy(window.__otpTraceDump());
   ```
   This copies a structured log of every OTP attempt: endpoint, attempt, online
   flag at start vs end, duration, error code, HTTP status. Each line starts
   with a trace id (e.g. `a3b1c2d4#1`) that matches the backend log line
   `Verification code created` / `Verifying code` / `Verification code resend
   requested` via the `trace` field.
3. On the backend, search Railway logs for that trace id to see which transport
   was used and how long it took.

## Backend knobs (Railway env vars)
All optional - sane defaults already shipped, change only if needed:
- `VERIFICATION_MAIL_TIME_BUDGET_SECONDS` (default 30): max wall time the
  backend will spend trying providers before responding. Keep low for demos so
  the desktop never sees a stuck request.
- `AUTH_LOGIN_CODE_FALLBACK` (default true): if all providers fail, returns the
  code in the JSON response so the user can still sign in.
- `EMAIL_TRY_RESEND_FIRST` / `EMAIL_TRY_BREVO_BEFORE_RESEND_ON_RAILWAY`:
  prefer the provider you trust most for the venue.

## Known good vs bad signals
- Good: trace lines like `... ok validate-email 1800ms online=true->true`.
- Wi-Fi flap: `... fail validate-email 8200ms online=true->false code=ERR_NETWORK`.
- Captive portal: `... fail validate-email 1500ms ... http=200` but the body is
  HTML, not JSON. Look for the yellow backend warning banner.
- Provider down: `... fail resend-verification-code 30000ms online=true->true
  http=502`.
