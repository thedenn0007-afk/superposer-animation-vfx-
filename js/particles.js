/**
 * particles.js — Particle system for NEXUS effects
 */

'use strict';

class Particle {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    const angle = options.angle ?? rand(0, Math.PI * 2);
    const speed = options.speed ?? rand(0.5, 3);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = 1.0;
    this.decay = options.decay ?? rand(0.012, 0.03);
    this.size = options.size ?? rand(1.5, 4);
    this.color = options.color ?? '#00e5ff';
    this.glow = options.glow ?? true;
    this.gravity = options.gravity ?? 0;
    this.shrink = options.shrink ?? true;
    this.trail = options.trail ?? false;
    this.prevX = x;
    this.prevY = y;
  }

  update() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = clamp(this.life, 0, 1);
    const size = this.shrink ? this.size * this.life : this.size;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.glow) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = this.color;
    }

    if (this.trail) {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = size * 0.6;
      ctx.beginPath();
      ctx.moveTo(this.prevX, this.prevY);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.1, size), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Orbit particle: circles a center point ──
class OrbitParticle {
  constructor(cx, cy, options = {}) {
    this.cx = cx;
    this.cy = cy;
    this.radius = options.radius ?? rand(20, 60);
    this.angle = options.angle ?? rand(0, Math.PI * 2);
    this.speed = options.speed ?? rand(0.02, 0.06) * (Math.random() > 0.5 ? 1 : -1);
    this.size = options.size ?? rand(1.5, 3.5);
    this.color = options.color ?? '#00e5ff';
    this.life = 1.0;
    this.decay = options.decay ?? 0.003;
    this.elevation = options.elevation ?? rand(-15, 15);
  }

  update(cx, cy) {
    this.cx = cx;
    this.cy = cy;
    this.angle += this.speed;
    this.life -= this.decay;
    return this.life > 0;
  }

  get x() { return this.cx + Math.cos(this.angle) * this.radius; }
  get y() { return this.cy + Math.sin(this.angle) * this.radius + this.elevation; }

  draw(ctx) {
    const alpha = clamp(this.life, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Particle Manager ──
class ParticleSystem {
  constructor() {
    this.particles = [];
    this.orbiters = [];
  }

  // Burst of regular particles
  burst(x, y, count, options = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, options));
    }
  }

  // Continuous emitter helper (call per frame)
  emit(x, y, count, options = {}) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new Particle(x, y, options));
    }
  }

  // Add orbit particle
  addOrbiter(cx, cy, options = {}) {
    this.orbiters.push(new OrbitParticle(cx, cy, options));
  }

  // Update orbiters to follow new center
  updateOrbiters(cx, cy) {
    this.orbiters = this.orbiters.filter(o => o.update(cx, cy));
  }

  clearOrbiters() {
    this.orbiters = [];
  }

  update() {
    this.particles = this.particles.filter(p => p.update());
  }

  draw(ctx) {
    this.particles.forEach(p => p.draw(ctx));
    this.orbiters.forEach(o => o.draw(ctx));
  }

  get count() {
    return this.particles.length + this.orbiters.length;
  }

  clear() {
    this.particles = [];
    this.orbiters = [];
  }
}
