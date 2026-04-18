/**
 * main.js — NEXUS Superpower Simulator
 * Entry point: initialises MediaPipe, canvas loop, and ties everything together.
 */

'use strict';

// ════════════════════════════════════════════
// GLOBALS
// ════════════════════════════════════════════
let currentMode = 'sphere'; // 'sphere' | 'telekinesis' | 'shield'
let intensityMultiplier = 1.0;

const videoEl  = document.getElementById('webcam');
const canvas   = document.getElementById('overlay');
const ctx      = canvas.getContext('2d');

// Shared dimension refs (used by TelekinesisObject)
window._cw = 800;
window._ch = 600;

// Systems
const ps         = new ParticleSystem();
const sphere     = new EnergySphere(ps);
const forceField = new ForceField(ps);
let telekinesisSystem; // created after canvas sized

const gestureDetector = new GestureDetector();
const hud = new HUD();

// Smooth hand points
const smoothPalm  = new SmoothPoint(0.35);
const smoothPinch = new SmoothPoint(0.35);
const smoothThumb = new SmoothPoint(0.35);
const smoothIndex = new SmoothPoint(0.35);

// Landmark state
let rawLandmarks = null;
let gestureState  = {};

// FPS tracking
let frameCount = 0;
let fpsTimer   = 0;
let displayFPS = 0;
let lastTime   = performance.now();

// Active camera handle (so we can stop it)
let activeCameraHandle = null;
let cameraRunning = false;

// Camera overlay
const camOverlay = (() => {
  const el = document.createElement('div');
  el.id = 'cam-overlay';
  el.innerHTML = `
    <div class="cam-icon">📷</div>
    <h2>NEXUS SUPERPOWER SIMULATOR</h2>
    <p>Track your hand gestures with your webcam to control powers.</p>
    <button id="start-cam-btn" onclick="startCamera()"
      style="margin-top:20px;padding:12px 32px;background:transparent;
             border:2px solid var(--cyan);color:var(--cyan);
             font-family:var(--font-d,monospace);font-size:13px;
             letter-spacing:3px;cursor:pointer;border-radius:3px;
             text-transform:uppercase;transition:all .2s"
      onmouseover="this.style.background='var(--cyan)';this.style.color='#000'"
      onmouseout="this.style.background='transparent';this.style.color='var(--cyan)'">
      ▶ START CAMERA
    </button>
    <p style="margin-top:12px;font-size:10px;color:var(--text-dim)">
      Or use DEMO MODE (mouse only) — camera optional
    </p>
    <button onclick="startDemoModeManual()"
      style="margin-top:4px;padding:6px 18px;background:transparent;
             border:1px solid var(--text-dim);color:var(--text-dim);
             font-family:var(--font-d,monospace);font-size:10px;
             letter-spacing:2px;cursor:pointer;border-radius:3px">
      DEMO MODE
    </button>`;
  document.getElementById('main-area').appendChild(el);
  return el;
})();

// ════════════════════════════════════════════
// CANVAS RESIZE
// ════════════════════════════════════════════
function resizeCanvas() {
  const area = document.getElementById('main-area');
  const rect  = area.getBoundingClientRect();
  canvas.width  = rect.width;
  canvas.height = rect.height;
  window._cw = rect.width;
  window._ch = rect.height;
}

window.addEventListener('resize', () => {
  resizeCanvas();
  if (telekinesisSystem) telekinesisSystem.reinitObjects(canvas.width, canvas.height);
});

// ════════════════════════════════════════════
// MODE SWITCHING
// ════════════════════════════════════════════
function setMode(mode) {
  if (!MODES[mode]) return;
  const prev = currentMode;
  currentMode = mode;
  hud.setMode(mode);
  logger.log(`Switched to ${MODES[mode].label}`, 'ok');
  hud.flashGesture(MODES[mode].icon + ' ' + MODES[mode].label);

  // Deactivate prev
  if (prev === 'sphere') sphere.deactivate();
  if (prev === 'shield') forceField.deactivate();
}

// Expose globally for HTML onclick
window.setMode = setMode;

// ════════════════════════════════════════════
// MEDIAPIPE HANDS SETUP
// ════════════════════════════════════════════
// ── Build the MediaPipe Hands processor (shared) ──
function buildHandsProcessor() {
  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.55,
  });
  hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      rawLandmarks = results.multiHandLandmarks[0];
    } else {
      rawLandmarks = null;
    }
  });
  return hands;
}

// ── Strategy 1: MediaPipe Camera helper ──
async function tryMPCamera(hands) {
  return new Promise((resolve, reject) => {
    const camera = new Camera(videoEl, {
      onFrame: async () => { await hands.send({ image: videoEl }); },
      width: 1280, height: 720,
    });
    camera.start().then(() => resolve(camera)).catch(reject);
  });
}

// ── Stop active camera stream ──
function stopCamera() {
  if (activeCameraHandle) {
    try { activeCameraHandle.stop(); } catch (_) {}
    activeCameraHandle = null;
  }
  if (videoEl.srcObject) {
    videoEl.srcObject.getTracks().forEach(t => t.stop());
    videoEl.srcObject = null;
  }
  cameraRunning = false;
  rawLandmarks = null;
  hud.setCamReady(false);
  logger.log('Camera stopped', 'warn');
  _updateCamToggleBtn();
}

function _updateCamToggleBtn() {
  const btn = document.getElementById('cam-toggle-btn');
  if (!btn) return;
  if (cameraRunning) {
    btn.textContent = '⏹ CAM OFF';
    btn.style.borderColor = '#ff4444';
    btn.style.color = '#ff4444';
  } else {
    btn.textContent = '▶ CAM ON';
    btn.style.borderColor = 'var(--cyan)';
    btn.style.color = 'var(--cyan)';
  }
}

async function startCamera() {
  const btn = document.getElementById('start-cam-btn');
  if (btn) { btn.textContent = 'CONNECTING...'; btn.disabled = true; }
  await initMediaPipe();
}

function startDemoModeManual() {
  camOverlay.classList.add('hidden');
  startDemoMode();
  _updateCamToggleBtn();
}

window.startCamera = startCamera;
window.startDemoModeManual = startDemoModeManual;
window.toggleCamera = function() {
  if (cameraRunning) stopCamera();
  else startCamera();
};

// ── Strategy 2: getUserMedia directly → feed to MediaPipe manually ──
async function tryGetUserMedia(hands) {
  // Try ideal first, then fall back to simpler constraints
  const constraintSets = [
    { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } },
    { video: { facingMode: 'user' } },
    { video: true },
  ];

  let stream = null;
  for (const constraints of constraintSets) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (_) { /* try next */ }
  }
  if (!stream) throw new Error('No camera stream available from getUserMedia');

  videoEl.srcObject = stream;
  await new Promise((res, rej) => {
    videoEl.onloadedmetadata = res;
    videoEl.onerror = rej;
  });
  await videoEl.play();

  // Manual frame pump — sends video frames to MediaPipe
  let running = true;
  const pump = async () => {
    if (!running) return;
    if (videoEl.readyState >= 2) {
      await hands.send({ image: videoEl });
    }
    requestAnimationFrame(pump);
  };
  requestAnimationFrame(pump);

  return { stop: () => { running = false; stream.getTracks().forEach(t => t.stop()); } };
}

// ── Demo / mouse mode (no camera needed) ──
function startDemoMode() {
  logger.log('DEMO MODE: no camera found', 'warn');
  logger.log('Move mouse over viewport', 'info');
  logger.log('Click = pinch, Shift+move = open palm', 'info');

  hud.setCamReady(false);
  camOverlay.innerHTML = `
    <div class="cam-icon">🖱</div>
    <h2>DEMO MODE</h2>
    <p>No camera detected. Control powers with your <strong style="color:var(--cyan)">mouse</strong>.</p>
    <ul style="text-align:left;font-size:11px;color:var(--text-dim);line-height:2;margin-top:8px;list-style:none">
      <li>🖱 <strong style="color:var(--text)">Move</strong> → aim power</li>
      <li>🖱 <strong style="color:var(--text)">Click &amp; hold</strong> → pinch gesture</li>
      <li>⇧ <strong style="color:var(--text)">Shift + move</strong> → open palm</li>
    </ul>
    <button onclick="document.getElementById('cam-overlay').classList.add('hidden')"
      style="margin-top:16px;padding:8px 20px;background:transparent;border:1px solid var(--cyan);
             color:var(--cyan);font-family:var(--font-d,monospace);font-size:11px;
             letter-spacing:2px;cursor:pointer;border-radius:3px">
      ENTER DEMO
    </button>`;

  const main = document.getElementById('main-area');
  let mouseX = canvas.width / 2, mouseY = canvas.height / 2;
  let mouseDown = false, shiftHeld = false;
  let demoHoldFrames = 0;

  main.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
    shiftHeld = e.shiftKey;
  });
  main.addEventListener('mousedown', () => { mouseDown = true; demoHoldFrames = 0; });
  main.addEventListener('mouseup',   () => { mouseDown = false; demoHoldFrames = 0; });
  main.addEventListener('mouseleave',() => { mouseDown = false; });

  // Inject synthetic landmarks each frame via a hook
  window._demoTick = () => {
    if (mouseDown) demoHoldFrames++;
    else demoHoldFrames = 0;

    // Build a minimal fake landmark set so gesture detector works normally
    const nx = 1 - (mouseX / canvas.width);   // un-mirror for landmark space
    const ny = mouseY / canvas.height;

    const spread = (shiftHeld && !mouseDown) ? 0.14 : 0.04;
    const pinchD = mouseDown ? 0.03 : 0.12;

    // 21 landmarks; we only need a few to be accurate
    const lm = Array.from({ length: 21 }, () => ({ x: nx, y: ny, z: 0 }));

    // WRIST (0)
    lm[0] = { x: nx, y: clamp(ny + 0.18, 0, 1), z: 0 };
    // THUMB_TIP (4) — offset for pinch
    lm[4] = { x: clamp(nx - pinchD / 2, 0, 1), y: clamp(ny - 0.02, 0, 1), z: 0 };
    // INDEX_TIP (8)
    lm[8] = { x: clamp(nx + pinchD / 2, 0, 1), y: clamp(ny - 0.05, 0, 1), z: 0 };
    // MIDDLE/RING/PINKY tips — spread for open palm
    lm[12] = { x: nx,                           y: clamp(ny - spread, 0, 1), z: 0 };
    lm[16] = { x: clamp(nx + spread * 0.6, 0,1),y: clamp(ny - spread * 0.8, 0, 1), z: 0 };
    lm[20] = { x: clamp(nx + spread, 0, 1),     y: clamp(ny - spread * 0.5, 0, 1), z: 0 };
    // INDEX_MCP (5), MIDDLE_MCP (9)
    lm[5]  = { x: clamp(nx + 0.04, 0, 1), y: clamp(ny + 0.06, 0, 1), z: 0 };
    lm[9]  = { x: nx,                     y: clamp(ny + 0.08, 0, 1), z: 0 };

    rawLandmarks = lm;
  };
}

// ── Main init: try cameras in sequence, fall back to demo ──
async function initMediaPipe() {
  const hands = buildHandsProcessor();

  // Check if getUserMedia is even available
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    logger.log('getUserMedia not supported', 'error');
    startDemoMode();
    return;
  }

  // List available video devices first
  let videoDevices = [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(d => d.kind === 'videoinput');
    logger.log(`Found ${videoDevices.length} camera(s)`, videoDevices.length ? 'ok' : 'warn');
  } catch (_) { /* enumerateDevices can fail silently */ }

  if (videoDevices.length === 0) {
    logger.log('No video devices found', 'warn');
    startDemoMode();
    return;
  }

  // Strategy 1: MediaPipe Camera helper
  try {
    logger.log('Trying MediaPipe Camera...', 'info');
    activeCameraHandle = await tryMPCamera(hands);
    cameraRunning = true;
    camOverlay.classList.add('hidden');
    hud.setCamReady(true);
    logger.log('Camera ready (MP Camera API)', 'ok');
    _updateCamToggleBtn();
    return;
  } catch (e1) {
    logger.log(`MP Camera failed: ${e1.message}`, 'warn');
  }

  // Strategy 2: Raw getUserMedia
  try {
    logger.log('Trying getUserMedia fallback...', 'info');
    activeCameraHandle = await tryGetUserMedia(hands);
    cameraRunning = true;
    camOverlay.classList.add('hidden');
    hud.setCamReady(true);
    logger.log('Camera ready (getUserMedia)', 'ok');
    _updateCamToggleBtn();
    return;
  } catch (e2) {
    logger.log(`getUserMedia failed: ${e2.message}`, 'warn');
  }

  // Final fallback: show error on overlay
  const btn = document.getElementById('start-cam-btn');
  if (btn) { btn.textContent = '▶ START CAMERA'; btn.disabled = false; }
  logger.log('Camera unavailable — try DEMO MODE', 'error');
}

// ════════════════════════════════════════════
// MAIN ANIMATION LOOP
// ════════════════════════════════════════════
function animate(now) {
  requestAnimationFrame(animate);

  const dt = (now - lastTime) / 16.67; // ~1 at 60fps
  lastTime = now;

  // FPS
  frameCount++;
  fpsTimer += now - (fpsTimer === 0 ? now : fpsTimer);
  fpsTimer = now;
  if (frameCount % 30 === 0) {
    displayFPS = Math.round(1000 / (dt * 16.67));
    hud.setFPS(displayFPS);
  }

  // ── Demo mode tick (mouse-based landmarks) ──
  if (window._demoTick) window._demoTick();

  // ── Clear canvas ──
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── Process landmarks ──
  let points = null;
  if (rawLandmarks) {
    gestureState = gestureDetector.detect(rawLandmarks);
    points = GestureDetector.extractPoints(rawLandmarks, canvas.width, canvas.height);

    if (points) {
      smoothPalm.setTarget(points.palmCenter.x, points.palmCenter.y);
      smoothPinch.setTarget(points.pinchMid.x, points.pinchMid.y);
      smoothThumb.setTarget(points.thumbTip.x, points.thumbTip.y);
      smoothIndex.setTarget(points.indexTip.x, points.indexTip.y);
    }
  } else {
    gestureState = gestureDetector.detect(null);
    smoothPalm.active = false;
    smoothPinch.active = false;
  }

  smoothPalm.update();
  smoothPinch.update();
  smoothThumb.update();
  smoothIndex.update();

  // ── HUD gesture display ──
  hud.setGestures(gestureState.isPinching, gestureState.isOpenPalm, gestureState.isFist);
  hud.updateHandData(smoothPalm.active ? {
    thumbTip:   { x: smoothThumb.x, y: smoothThumb.y },
    indexTip:   { x: smoothIndex.x, y: smoothIndex.y },
    palmCenter: { x: smoothPalm.x,  y: smoothPalm.y  },
  } : null, gestureState.pinchDist);

  // ── Draw grid background ──
  _drawGrid(ctx);

  // ── Power logic ──
  if (smoothPalm.active) {
    switch (currentMode) {
      case 'sphere':
        sphere.update(
          smoothPalm.x, smoothPalm.y,
          gestureState.isPinching,
          gestureState.pinchDuration,
          dt
        );
        break;

      case 'telekinesis':
        if (telekinesisSystem) {
          telekinesisSystem.update(
            smoothPinch.x, smoothPinch.y,
            gestureState.isPinching,
            gestureState.justReleased
          );
        }
        break;

      case 'shield':
        forceField.update(smoothPalm.x, smoothPalm.y, gestureState.isOpenPalm, dt);
        break;
    }
  } else {
    // Hand not visible — let effects fade naturally
    if (currentMode === 'sphere') {
      sphere.update(smoothPalm.x, smoothPalm.y, false, 0, dt);
    }
    if (currentMode === 'shield') {
      forceField.update(smoothPalm.x, smoothPalm.y, false, dt);
    }
  }

  // ── Update & draw particles ──
  ps.update();
  ps.draw(ctx);

  // ── Draw powers ──
  switch (currentMode) {
    case 'sphere':
      if (smoothPalm.active) sphere.draw(ctx, smoothPalm.x, smoothPalm.y);
      break;
    case 'telekinesis':
      if (telekinesisSystem) telekinesisSystem.draw(ctx);
      _drawPinchIndicator(ctx);
      break;
    case 'shield':
      if (smoothPalm.active) forceField.draw(ctx, smoothPalm.x, smoothPalm.y);
      break;
  }

  // ── Draw hand landmark dots (subtle) ──
  if (smoothPalm.active) _drawHandHints(ctx);

  // ── Intensity ──
  const intensityVal = currentMode === 'sphere'
    ? sphere.intensity
    : currentMode === 'shield'
      ? forceField.shieldAlpha
      : (telekinesisSystem?.grabbedObj ? 1 : 0);
  hud.setIntensity(clamp(intensityVal, 0, 1));

  // ── Stats ──
  hud.updateStats(ps.count, telekinesisSystem?.objects.length ?? 0);
}

// ════════════════════════════════════════════
// DRAWING HELPERS
// ════════════════════════════════════════════
function _drawGrid(ctx) {
  const w = canvas.width, h = canvas.height;
  const spacing = 50;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,50,80,0.25)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < w; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.restore();
}

function _drawHandHints(ctx) {
  // Subtle crosshair at palm center
  const px = smoothPalm.x, py = smoothPalm.y;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#00e5ff';
  const size = 10;
  ctx.beginPath();
  ctx.moveTo(px - size, py); ctx.lineTo(px + size, py);
  ctx.moveTo(px, py - size); ctx.lineTo(px, py + size);
  ctx.stroke();

  // Thumb and index dots
  [
    { p: smoothThumb, c: '#ff006e' },
    { p: smoothIndex, c: '#ffd60a' },
  ].forEach(({ p, c }) => {
    ctx.shadowColor = c;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function _drawPinchIndicator(ctx) {
  if (!smoothPinch.active || !gestureState.isPinching) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = 'var(--magenta, #ff006e)';
  ctx.shadowBlur = 12;
  ctx.shadowColor = '#ff006e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(smoothPinch.x, smoothPinch.y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ════════════════════════════════════════════
// KEYBOARD CONTROLS
// ════════════════════════════════════════════
document.addEventListener('keydown', (e) => {
  // Don't hijack command input
  if (document.activeElement === document.getElementById('cmd-input')) return;

  switch (e.key) {
    case '1': setMode('sphere');      break;
    case '2': setMode('telekinesis'); break;
    case '3': setMode('shield');      break;
  }
});

// ════════════════════════════════════════════
// COMMAND SYSTEM INIT
// ════════════════════════════════════════════
const logger = new ConsoleLogger(document.getElementById('console-log'));

const cmdProcessor = new CommandProcessor(
  logger,
  (mode) => setMode(mode),
  (action) => {
    switch (action) {
      case 'expand':
        intensityMultiplier = clamp(intensityMultiplier + 0.25, 0.25, 3.0);
        sphere.maxRadius = Math.min(180, sphere.maxRadius + 20);
        break;
      case 'compress':
        intensityMultiplier = clamp(intensityMultiplier - 0.25, 0.25, 3.0);
        sphere.maxRadius = Math.max(60, sphere.maxRadius - 20);
        break;
      case 'reset':
        sphere.deactivate();
        forceField.deactivate();
        ps.clear();
        if (telekinesisSystem) telekinesisSystem.reset();
        intensityMultiplier = 1.0;
        sphere.maxRadius = 140;
        break;
    }
  }
);

// ════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════
(function boot() {
  resizeCanvas();

  // Init telekinesis after canvas is sized
  window._cw = canvas.width;
  window._ch = canvas.height;
  telekinesisSystem = new Telekinesis(ps);
  telekinesisSystem.reinitObjects(canvas.width, canvas.height);

  hud.setMode('sphere');

  logger.log('Rendering engine ready', 'ok');
  logger.log('Press START CAMERA to begin', 'info');

  requestAnimationFrame(animate);
})();
