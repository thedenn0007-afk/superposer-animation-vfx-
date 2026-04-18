/**
 * powers.js — Energy Sphere, Telekinesis, Force Field rendering
 */

'use strict';

// ════════════════════════════════════════════
// POWER 1 — ENERGY SPHERE
// ════════════════════════════════════════════
class EnergySphere {
  constructor(particleSystem) {
    this.ps = particleSystem;
    this.radius = 30;
    this.targetRadius = 30;
    this.maxRadius = 140;
    this.minRadius = 28;
    this.pulsePhase = 0;
    this.active = false;
    this.intensity = 0;
    this.orbitCount = 0;
    this.maxOrbiters = 22;
    this._glowPhase = 0;
  }

  update(palmX, palmY, isPinching, pinchDuration, dt) {
    this.active = true;
    this.pulsePhase += 0.06;
    this._glowPhase += 0.04;

    if (isPinching) {
      this.targetRadius = clamp(
        this.minRadius + (pinchDuration * 0.6),
        this.minRadius,
        this.maxRadius
      );
      this.intensity = clamp((this.targetRadius - this.minRadius) / (this.maxRadius - this.minRadius), 0, 1);

      // Emit particles while pinching
      const color = this._colorFromIntensity(this.intensity);
      this.ps.emit(palmX, palmY, 2, {
        speed: rand(1.5, 4),
        size: rand(1.5, 3.5),
        decay: rand(0.018, 0.035),
        color,
        glow: true,
        trail: this.intensity > 0.5,
      });

      // Orbit particles
      if (this.orbitCount < this.maxOrbiters && Math.random() < 0.25) {
        const r = this.radius * rand(1.1, 1.5);
        this.ps.addOrbiter(palmX, palmY, {
          radius: r,
          speed: rand(0.03, 0.07) * (Math.random() > 0.5 ? 1 : -1),
          size: rand(1.5, 3),
          color,
          decay: 0.004,
        });
        this.orbitCount = Math.min(this.orbitCount + 1, this.maxOrbiters);
      }
    } else {
      this.targetRadius = lerp(this.targetRadius, this.minRadius, 0.05);
      this.intensity = lerp(this.intensity, 0, 0.05);
      this.orbitCount = Math.max(0, this.orbitCount - 1);

      if (Math.random() < 0.3) {
        this.ps.emit(palmX, palmY, 1, {
          speed: rand(0.5, 1.8),
          size: rand(1, 2.5),
          decay: rand(0.02, 0.04),
          color: '#00e5ff',
          glow: true,
        });
      }
    }

    this.radius = lerp(this.radius, this.targetRadius, 0.12);
    this.ps.updateOrbiters(palmX, palmY);
  }

  draw(ctx, palmX, palmY) {
    if (!this.active) return;

    const pulse = Math.sin(this.pulsePhase) * 0.15 + 0.85;
    const glow  = Math.sin(this._glowPhase) * 0.3 + 0.7;
    const r = this.radius * pulse;
    const intensity = this.intensity;

    // ── Outer glow aura ──
    const hue  = lerp(180, 290, intensity);   // cyan → magenta
    const aura = ctx.createRadialGradient(palmX, palmY, r * 0.5, palmX, palmY, r * 2.5);
    aura.addColorStop(0, `hsla(${hue},100%,65%,${0.22 * glow})`);
    aura.addColorStop(0.5, `hsla(${hue},100%,55%,${0.09 * glow})`);
    aura.addColorStop(1, 'transparent');
    ctx.save();
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // ── Core sphere ──
    const core = ctx.createRadialGradient(palmX - r * 0.3, palmY - r * 0.3, r * 0.05,
                                           palmX, palmY, r);
    const c1 = `hsla(${hue + 30},100%,90%,0.95)`;
    const c2 = `hsla(${hue},100%,60%,0.85)`;
    const c3 = `hsla(${hue - 20},100%,40%,0.6)`;
    core.addColorStop(0, c1);
    core.addColorStop(0.45, c2);
    core.addColorStop(1, c3);

    ctx.shadowBlur = 40 * glow;
    ctx.shadowColor = `hsl(${hue},100%,65%)`;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r, 0, Math.PI * 2);
    ctx.fill();

    // ── Inner galaxy swirl ──
    if (r > 20) {
      this._drawSwirl(ctx, palmX, palmY, r, hue);
    }

    // ── Ring ──
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${hue},100%,70%)`;
    ctx.strokeStyle = `hsla(${hue},100%,75%,0.6)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r * 1.15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  _drawSwirl(ctx, cx, cy, r, hue) {
    const n = 3;
    const t = this.pulsePhase;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.translate(cx, cy);
    for (let i = 0; i < n; i++) {
      const a = t + (i / n) * Math.PI * 2;
      const x1 = Math.cos(a) * r * 0.6;
      const y1 = Math.sin(a) * r * 0.6;
      const x2 = Math.cos(a + Math.PI) * r * 0.6;
      const y2 = Math.sin(a + Math.PI) * r * 0.6;
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, `hsla(${hue + 60},100%,80%,0)`);
      g.addColorStop(0.5, `hsla(${hue},100%,90%,0.8)`);
      g.addColorStop(1, `hsla(${hue + 60},100%,80%,0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth = r * 0.12;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(
        x1 * 0.3, y1 * 0.3 + r * 0.4,
        x2 * 0.3, y2 * 0.3 - r * 0.4,
        x2, y2
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  _colorFromIntensity(t) {
    const h = lerp(180, 295, t);
    return `hsl(${h},100%,65%)`;
  }

  deactivate() {
    this.active = false;
    this.radius = this.minRadius;
    this.targetRadius = this.minRadius;
    this.intensity = 0;
    this.orbitCount = 0;
    this.ps.clearOrbiters();
  }
}

// ════════════════════════════════════════════
// POWER 2 — TELEKINESIS
// ════════════════════════════════════════════
class TelekinesisObject {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.vx = rand(-0.5, 0.5);
    this.vy = rand(-0.5, 0.5);
    this.size = rand(18, 36);
    this.type = type; // 'circle', 'diamond', 'triangle', 'hex'
    this.hue = randInt(160, 340);
    this.angle = rand(0, Math.PI * 2);
    this.spinSpeed = rand(-0.03, 0.03);
    this.grabbed = false;
    this.targetX = x;
    this.targetY = y;
    this.pulsePhase = rand(0, Math.PI * 2);
    this.bobOffset = rand(0, Math.PI * 2);
    this.bobAmp = rand(3, 8);
    this.time = 0;
    this.glowIntensity = 0;
  }

  update(dt) {
    this.time += 0.02;
    this.pulsePhase += 0.04;
    this.angle += this.spinSpeed;

    if (this.grabbed) {
      this.x = lerp(this.x, this.targetX, 0.18);
      this.y = lerp(this.y, this.targetY, 0.18);
      this.glowIntensity = lerp(this.glowIntensity, 1, 0.1);
      this.spinSpeed = lerp(this.spinSpeed, 0.08, 0.05);
    } else {
      // Float gently
      this.x += this.vx;
      this.y += Math.sin(this.time + this.bobOffset) * 0.3;
      this.vx *= 0.995;

      // Bounce off edges
      const pad = this.size + 10;
      if (this.x < pad)   { this.x = pad;  this.vx = Math.abs(this.vx) * 0.7; }
      if (this.x > window._cw - pad) { this.x = window._cw - pad; this.vx = -Math.abs(this.vx) * 0.7; }
      if (this.y < pad)   { this.y = pad; }
      if (this.y > window._ch - pad) { this.y = window._ch - pad; }
      this.glowIntensity = lerp(this.glowIntensity, 0.3, 0.05);
    }
  }

  draw(ctx) {
    const pulse = Math.sin(this.pulsePhase) * 0.1 + 0.9;
    const s = this.size * pulse;
    const alpha = this.grabbed ? 0.9 : 0.65;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalAlpha = alpha;

    const glow = `hsl(${this.hue},100%,65%)`;
    ctx.shadowBlur = this.grabbed ? 30 : 12;
    ctx.shadowColor = glow;

    // Fill
    const grad = ctx.createRadialGradient(0, -s * 0.2, s * 0.1, 0, 0, s);
    grad.addColorStop(0, `hsla(${this.hue + 40},100%,85%,0.9)`);
    grad.addColorStop(0.6, `hsla(${this.hue},100%,55%,0.7)`);
    grad.addColorStop(1, `hsla(${this.hue - 20},100%,30%,0.5)`);

    ctx.fillStyle = grad;
    ctx.strokeStyle = `hsla(${this.hue},100%,75%,0.8)`;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    switch (this.type) {
      case 'circle':
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        break;
      case 'diamond':
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        break;
      case 'triangle':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          i === 0 ? ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s)
                  : ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        }
        ctx.closePath();
        break;
      case 'hex':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          i === 0 ? ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s)
                  : ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        }
        ctx.closePath();
        break;
    }
    ctx.fill();
    ctx.stroke();

    // Inner cross highlight
    if (this.grabbed) {
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-s * 0.4, 0); ctx.lineTo(s * 0.4, 0);
      ctx.moveTo(0, -s * 0.4); ctx.lineTo(0, s * 0.4);
      ctx.stroke();
    }

    ctx.restore();
  }
}

class Telekinesis {
  constructor(particleSystem) {
    this.ps = particleSystem;
    this.objects = [];
    this.grabbedObj = null;
    this.grabThreshold = 70;
    this._initObjects();
  }

  _initObjects() {
    const types = ['circle', 'diamond', 'triangle', 'hex'];
    const cw = window._cw || 800;
    const ch = window._ch || 600;
    for (let i = 0; i < 7; i++) {
      const type = types[i % types.length];
      this.objects.push(new TelekinesisObject(
        rand(80, cw - 80),
        rand(80, ch - 80),
        type
      ));
    }
  }

  reinitObjects(cw, ch) {
    window._cw = cw;
    window._ch = ch;
    if (this.objects.length === 0) this._initObjects();
  }

  update(pinchX, pinchY, isPinching, justReleased) {
    // Try to grab
    if (isPinching && !this.grabbedObj) {
      let closest = null;
      let closestDist = this.grabThreshold;
      for (const obj of this.objects) {
        const d = dist2d(pinchX, pinchY, obj.x, obj.y);
        if (d < closestDist) { closestDist = d; closest = obj; }
      }
      if (closest) {
        this.grabbedObj = closest;
        closest.grabbed = true;
        // Burst on grab
        this.ps.burst(pinchX, pinchY, 12, {
          color: `hsl(${closest.hue},100%,65%)`,
          speed: rand(2, 5),
          size: rand(2, 4),
          decay: 0.025,
        });
      }
    }

    if (this.grabbedObj) {
      this.grabbedObj.targetX = pinchX;
      this.grabbedObj.targetY = pinchY;

      // Trail particles
      if (Math.random() < 0.4) {
        this.ps.emit(this.grabbedObj.x, this.grabbedObj.y, 1, {
          speed: rand(0.5, 2),
          size: rand(1, 2.5),
          decay: 0.04,
          color: `hsl(${this.grabbedObj.hue},100%,65%)`,
        });
      }
    }

    if (justReleased && this.grabbedObj) {
      this.ps.burst(this.grabbedObj.x, this.grabbedObj.y, 16, {
        color: `hsl(${this.grabbedObj.hue},100%,65%)`,
        speed: rand(2, 6),
        decay: 0.02,
      });
      this.grabbedObj.grabbed = false;
      this.grabbedObj.vx = rand(-1.5, 1.5);
      this.grabbedObj = null;
    }

    this.objects.forEach(o => o.update());
  }

  draw(ctx) {
    // Draw connection beam
    if (this.grabbedObj) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = `hsl(${this.grabbedObj.hue},100%,65%)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsl(${this.grabbedObj.hue},100%,65%)`;
      ctx.beginPath();
      ctx.moveTo(this.grabbedObj.targetX, this.grabbedObj.targetY);
      ctx.lineTo(this.grabbedObj.x, this.grabbedObj.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    this.objects.forEach(o => o.draw(ctx));
  }

  reset() {
    this.objects = [];
    this.grabbedObj = null;
    this._initObjects();
  }
}

// ════════════════════════════════════════════
// POWER 3 — FORCE FIELD
// ════════════════════════════════════════════
class ForceField {
  constructor(particleSystem) {
    this.ps = particleSystem;
    this.waves = [];
    this.hexagons = [];
    this.active = false;
    this.baseRadius = 80;
    this.phase = 0;
    this.shieldAlpha = 0;
    this._hexPhase = 0;
  }

  update(palmX, palmY, isOpen, dt) {
    this.phase += 0.05;
    this._hexPhase += 0.02;
    this.active = isOpen;

    if (isOpen) {
      this.shieldAlpha = lerp(this.shieldAlpha, 0.7, 0.1);

      // Spawn ripple waves periodically
      if (Math.random() < 0.08) {
        this.waves.push({ x: palmX, y: palmY, r: 0, maxR: this.baseRadius * 2.2, alpha: 0.6 });
      }

      // Shield edge particles
      if (Math.random() < 0.3) {
        const a = rand(0, Math.PI * 2);
        const r = this.baseRadius;
        this.ps.emit(
          palmX + Math.cos(a) * r,
          palmY + Math.sin(a) * r,
          1, { speed: rand(0.3, 1.2), size: rand(1, 2.5),
               decay: 0.03, color: '#00e5ff', gravity: -0.02 }
        );
      }
    } else {
      this.shieldAlpha = lerp(this.shieldAlpha, 0, 0.08);
    }

    // Update ripple waves
    this.waves = this.waves.filter(w => {
      w.r  += 2.5;
      w.alpha -= 0.012;
      return w.alpha > 0;
    });
  }

  draw(ctx, palmX, palmY) {
    if (this.shieldAlpha < 0.01) return;
    const a = this.shieldAlpha;

    ctx.save();

    // ── Hex grid pattern inside shield ──
    this._drawHexGrid(ctx, palmX, palmY, a);

    // ── Main shield dome ──
    const pulse = Math.sin(this.phase) * 0.06 + 1.0;
    const r = this.baseRadius * pulse;

    const shieldGrad = ctx.createRadialGradient(palmX, palmY, r * 0.3, palmX, palmY, r);
    shieldGrad.addColorStop(0, `rgba(0,229,255,${0.05 * a})`);
    shieldGrad.addColorStop(0.6, `rgba(0,180,255,${0.08 * a})`);
    shieldGrad.addColorStop(1, `rgba(0,229,255,${0.35 * a})`);

    ctx.shadowBlur = 30;
    ctx.shadowColor = `rgba(0,229,255,${0.5 * a})`;
    ctx.fillStyle = shieldGrad;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = `rgba(0,229,255,${0.7 * a})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner ring
    ctx.strokeStyle = `rgba(100,240,255,${0.4 * a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(palmX, palmY, r * 0.75, 0, Math.PI * 2);
    ctx.stroke();

    // ── Ripple waves ──
    for (const w of this.waves) {
      ctx.strokeStyle = `rgba(0,229,255,${w.alpha * a})`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawHexGrid(ctx, cx, cy, a) {
    const hexR = 18;
    const cols = 5, rows = 5;
    const offsetX = cx - cols * hexR * 1.5;
    const offsetY = cy - rows * hexR * Math.sqrt(3);

    ctx.save();
    ctx.globalAlpha = 0.18 * a;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 0.8;

    for (let row = 0; row < rows * 2; row++) {
      for (let col = 0; col < cols * 2; col++) {
        const hx = offsetX + col * hexR * 1.73;
        const hy = offsetY + row * hexR * 1.5 + (col % 2 ? hexR * 0.75 : 0);

        // Only draw hexes inside shield
        if (dist2d(hx, hy, cx, cy) > this.baseRadius * 0.95) continue;

        // Pulse each hex
        const d = dist2d(hx, hy, cx, cy);
        const hexA = Math.max(0, 1 - d / (this.baseRadius * 0.9));
        ctx.globalAlpha = hexA * 0.25 * a * (Math.sin(this._hexPhase + d * 0.1) * 0.3 + 0.7);

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const px = hx + Math.cos(angle) * hexR * 0.85;
          const py = hy + Math.sin(angle) * hexR * 0.85;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  deactivate() {
    this.shieldAlpha = 0;
    this.waves = [];
  }
}
