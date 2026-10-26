/**
 * Capture primary display thumbnail and upload to Laravel (Electron main process).
 */
const { desktopCapturer } = require('electron');

// ============================================================================
// ORIGINAL CONFIGURATION (Restore when upgraded to paid hosting):
// const CAPTURE_INTERVAL_MS = 3000;
// ============================================================================
// OPTIMIZED CONFIGURATION (For Render Free Tier / Multi-PC Lab Presentation):
// 8 seconds interval avoids choking the 512MB RAM server with 30-50 lab PCs.
const CAPTURE_INTERVAL_MS = 8000;

let captureInterval = null;
let uploadInFlight = false;

let uploadContext = {
  apiBaseUrl: null,
  token: null,
  computerName: null,
  gatewayIp: null,
};

function setScreenCaptureContext(ctx) {
  if (!ctx || typeof ctx !== 'object') {
    return;
  }
  if (ctx.apiBaseUrl) {
    let base = String(ctx.apiBaseUrl).trim().replace(/\/+$/, '');
    if (!/\/api$/i.test(base)) {
      base = `${base}/api`;
    }
    uploadContext.apiBaseUrl = base;
  }
  if (ctx.token) {
    uploadContext.token = ctx.token;
  }
  if (ctx.computerName !== undefined) {
    uploadContext.computerName = ctx.computerName;
  }
  if (ctx.gatewayIp !== undefined) {
    uploadContext.gatewayIp = ctx.gatewayIp;
  }
}

function clearScreenCaptureContext() {
  uploadContext = {
    apiBaseUrl: uploadContext.apiBaseUrl,
    token: null,
    computerName: null,
    gatewayIp: null,
  };
}

async function capturePrimaryDisplayJpeg() {
  // ============================================================================
  // ORIGINAL CONFIGURATION (Restore when upgraded to paid hosting):
  // const sources = await desktopCapturer.getSources({
  //   types: ['screen'],
  //   thumbnailSize: { width: 960, height: 540 },
  // });
  // const jpeg = primary.thumbnail.toJPEG(72);
  // ============================================================================
  // OPTIMIZED CONFIGURATION: 480x270 thumbnail at quality 40 (~25KB vs ~300KB)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 480, height: 270 },
  });

  if (!sources || sources.length === 0) {
    return null;
  }

  const primary =
    sources.find((s) => String(s.display_id) === '0' || String(s.id).startsWith('screen:0')) ||
    sources[0];

  if (!primary || !primary.thumbnail || primary.thumbnail.isEmpty()) {
    return null;
  }

  const jpeg = primary.thumbnail.toJPEG(40);
  const size = primary.thumbnail.getSize();

  return {
    buffer: jpeg,
    width: size.width,
    height: size.height,
  };
}

async function uploadFrameOnce() {
  if (uploadInFlight || !uploadContext.token || !uploadContext.apiBaseUrl) {
    return;
  }

  uploadInFlight = true;

  try {
    const captured = await capturePrimaryDisplayJpeg();
    if (!captured || !captured.buffer || captured.buffer.length === 0) {
      return;
    }

    const body = {
      image_base64: captured.buffer.toString('base64'),
      width: captured.width,
      height: captured.height,
      computer_name: uploadContext.computerName || undefined,
    };

    const response = await fetch(`${uploadContext.apiBaseUrl}/screen-monitor/frame`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${uploadContext.token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      console.log('🖥️ Screen frame uploaded');
    } else {
      const text = await response.text().catch(() => '');
      console.warn('⚠️ Screen frame upload failed:', response.status, text.slice(0, 200));
    }
  } catch (err) {
    console.warn('⚠️ Screen capture/upload error:', err && err.message ? err.message : err);
  } finally {
    uploadInFlight = false;
  }
}

function startScreenCaptureLoop() {
  if (captureInterval) {
    return;
  }

  console.log('🖥️ Screen capture loop started (every', CAPTURE_INTERVAL_MS, 'ms)');

  void uploadFrameOnce();

  captureInterval = setInterval(() => {
    void uploadFrameOnce();
  }, CAPTURE_INTERVAL_MS);
}

function stopScreenCaptureLoop() {
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
    console.log('🖥️ Screen capture loop stopped');
  }
  uploadInFlight = false;
}

module.exports = {
  setScreenCaptureContext,
  clearScreenCaptureContext,
  startScreenCaptureLoop,
  stopScreenCaptureLoop,
  capturePrimaryDisplayJpeg,
};
