/**
 * utils.js — Math & helper utilities for NEXUS
 */

'use strict';

// ── Linear interpolation ──
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── 2D distance ──
function dist2d(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Clamp value ──
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ── Random in range ──
function rand(min, max) {
  return min + Math.random() * (max - min);
}

// ── Random integer ──
function randInt(min, max) {
  return Math.floor(rand(min, max));
}

// ── Radians ──
function toRad(deg) { return deg * Math.PI / 180; }

// ── HSL color string ──
function hsl(h, s, l, a = 1) {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ── Smooth step ──
function smoothStep(t) {
  return t * t * (3 - 2 * t);
}

// ── Convert normalized MediaPipe coords to canvas pixels ──
function mpToCanvas(nx, ny, cw, ch) {
  // MediaPipe x is already mirrored-friendly; we mirror video so we flip x
  return {
    x: (1 - nx) * cw,
    y: ny * ch
  };
}

// ── Smooth coordinate tracker using lerp ──
class SmoothPoint {
  constructor(lerpFactor = 0.4) {
    this.x = 0;
    this.y = 0;
    this._tx = 0;
    this._ty = 0;
    this.lerpFactor = lerpFactor;
    this.active = false;
  }
  setTarget(x, y) {
    this._tx = x;
    this._ty = y;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x = lerp(this.x, this._tx, this.lerpFactor);
    this.y = lerp(this.y, this._ty, this.lerpFactor);
  }
  reset() {
    this.active = false;
    this.x = this._tx = 0;
    this.y = this._ty = 0;
  }
}
