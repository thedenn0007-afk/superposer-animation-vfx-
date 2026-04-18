/**
 * ui.js — HUD, command console, and UI state management
 */

'use strict';

// ── Console logger ──
class ConsoleLogger {
  constructor(el, maxLines = 18) {
    this.el = el;
    this.maxLines = maxLines;
    this.lines = [];
  }

  log(msg, type = 'info') {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.lines.push({ ts, msg, type });
    if (this.lines.length > this.maxLines) this.lines.shift();
    this._render();
  }

  _render() {
    this.el.innerHTML = this.lines.map(l =>
      `<div class="log-line ${l.type}"><span style="color:var(--text-dim)">${l.ts}</span> ${l.msg}</div>`
    ).join('');
    this.el.scrollTop = this.el.scrollHeight;
  }
}

// ── Mode names/icons/colors ──
const MODES = {
  sphere: { label: 'ENERGY SPHERE', icon: '⚡', color: '#00e5ff' },
  telekinesis: { label: 'TELEKINESIS', icon: '🌀', color: '#ff006e' },
  shield: { label: 'FORCE FIELD',  icon: '🛡',  color: '#39ff14' },
};

// ── HUD updater ──
class HUD {
  constructor() {
    this.modeNameEl     = document.getElementById('header-mode-name');
    this.activePowerEl  = document.getElementById('active-power-name');
    this.activePowerIcon= document.getElementById('active-power-icon');
    this.intensityBar   = document.getElementById('intensity-bar');
    this.intensityVal   = document.getElementById('intensity-value');
    this.fpsEl          = document.getElementById('fps-counter');
    this.camDot         = document.getElementById('cam-dot');
    this.camStatus      = document.getElementById('cam-status');

    this.dThumb   = document.getElementById('d-thumb');
    this.dIndex   = document.getElementById('d-index');
    this.dPalm    = document.getElementById('d-palm');
    this.dPinch   = document.getElementById('d-pinch');
    this.dParticles = document.getElementById('d-particles');
    this.dObjects   = document.getElementById('d-objects');

    this.gstPinch = document.getElementById('gst-pinch');
    this.gstOpen  = document.getElementById('gst-open');
    this.gstFist  = document.getElementById('gst-fist');

    this.gestureFlash = document.getElementById('gesture-flash');
    this._flashTimer = null;
  }

  setMode(mode) {
    const m = MODES[mode];
    if (!m) return;
    this.modeNameEl.textContent     = m.label;
    this.activePowerEl.textContent  = m.label;
    this.activePowerIcon.textContent = m.icon;
    this.modeNameEl.style.color     = m.color;
    this.activePowerEl.style.color  = m.color;
    this.activePowerEl.style.textShadow = `0 0 12px ${m.color}`;

    document.querySelectorAll('.power-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  setFPS(fps) {
    this.fpsEl.textContent = `FPS: ${fps}`;
    this.fpsEl.style.color = fps < 20 ? 'var(--red)' : fps < 28 ? 'var(--gold)' : 'var(--green)';
  }

  setCamReady(ready) {
    this.camDot.className = 'dot' + (ready ? ' active' : '');
    this.camStatus.textContent = ready ? 'CAMERA ACTIVE' : 'INITIALIZING';
  }

  setIntensity(v) {
    const pct = Math.round(v * 100);
    this.intensityBar.style.width = pct + '%';
    this.intensityVal.textContent = pct + '%';
    const hue = lerp(180, 300, v);
    this.intensityBar.style.background = `linear-gradient(90deg, hsl(180,100%,55%), hsl(${hue},100%,60%))`;
  }

  setGestures(pinch, open, fist) {
    this._setGesture(this.gstPinch, pinch, 'DETECTED');
    this._setGesture(this.gstOpen, open, 'DETECTED');
    this._setGesture(this.gstFist, fist, 'DETECTED');
  }

  _setGesture(el, active, label) {
    el.textContent = active ? label : '—';
    el.className = 'gesture-status' + (active ? ' active' : '');
  }

  updateHandData(points, pinchDist) {
    if (!points) {
      this.dThumb.textContent = '—';
      this.dIndex.textContent = '—';
      this.dPalm.textContent  = '—';
      this.dPinch.textContent = '—';
      return;
    }
    this.dThumb.textContent = `${~~points.thumbTip.x},${~~points.thumbTip.y}`;
    this.dIndex.textContent = `${~~points.indexTip.x},${~~points.indexTip.y}`;
    this.dPalm.textContent  = `${~~points.palmCenter.x},${~~points.palmCenter.y}`;
    this.dPinch.textContent = pinchDist ? pinchDist.toFixed(3) : '—';
  }

  updateStats(particleCount, objCount) {
    this.dParticles.textContent = particleCount;
    this.dObjects.textContent   = objCount;
  }

  flashGesture(text) {
    this.gestureFlash.textContent = text;
    this.gestureFlash.style.opacity = '1';
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this.gestureFlash.style.opacity = '0';
    }, 900);
  }
}

// ── Command processor ──
class CommandProcessor {
  constructor(logger, onModeChange, onModify) {
    this.logger = logger;
    this.onModeChange = onModeChange;
    this.onModify = onModify;

    this.input = document.getElementById('cmd-input');
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._process();
    });

    this.logger.log('NEXUS SYSTEM ONLINE', 'ok');
    this.logger.log('Type /help for commands', 'info');
  }

  _process() {
    const raw = this.input.value.trim();
    this.input.value = '';
    if (!raw) return;

    const cmd = raw.replace(/^\//, '').toLowerCase().trim();
    this.logger.log('> /' + cmd, 'info');

    switch (cmd) {
      case 'sphere':
      case 'energy':
        this.onModeChange('sphere');
        this.logger.log('Mode: ENERGY SPHERE', 'ok');
        break;
      case 'telekinesis':
      case 'tk':
        this.onModeChange('telekinesis');
        this.logger.log('Mode: TELEKINESIS', 'ok');
        break;
      case 'shield':
      case 'forcefield':
      case 'ff':
        this.onModeChange('shield');
        this.logger.log('Mode: FORCE FIELD', 'ok');
        break;
      case 'expand':
        this.onModify('expand');
        this.logger.log('Intensity expanded', 'ok');
        break;
      case 'compress':
        this.onModify('compress');
        this.logger.log('Intensity compressed', 'ok');
        break;
      case 'reset':
        this.onModify('reset');
        this.logger.log('Effects reset', 'warn');
        break;
      case 'help':
        this.logger.log('/sphere /shield /telekinesis', 'info');
        this.logger.log('/expand /compress /reset', 'info');
        break;
      default:
        this.logger.log('Unknown: /' + cmd, 'error');
    }
  }
}
