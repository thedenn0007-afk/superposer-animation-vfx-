/**
 * gestures.js — Gesture detection from MediaPipe landmarks
 */

'use strict';

// ── Landmark indices (MediaPipe Hands) ──
const LM = {
  WRIST:         0,
  THUMB_CMC:     1,
  THUMB_MCP:     2,
  THUMB_IP:      3,
  THUMB_TIP:     4,
  INDEX_MCP:     5,
  INDEX_PIP:     6,
  INDEX_DIP:     7,
  INDEX_TIP:     8,
  MIDDLE_MCP:    9,
  MIDDLE_PIP:   10,
  MIDDLE_DIP:   11,
  MIDDLE_TIP:   12,
  RING_MCP:     13,
  RING_PIP:     14,
  RING_DIP:     15,
  RING_TIP:     16,
  PINKY_MCP:    17,
  PINKY_PIP:    18,
  PINKY_DIP:    19,
  PINKY_TIP:    20,
};

class GestureDetector {
  constructor() {
    this.pinchThreshold    = 0.07;  // normalized distance
    this.openPalmThreshold = 0.18;
    this.fistThreshold     = 0.06;

    // Smoothed gesture state
    this.isPinching  = false;
    this.isOpenPalm  = false;
    this.isFist      = false;

    this.pinchDuration = 0; // frames held
    this._prevPinch    = false;
  }

  /**
   * Analyze landmarks and return gesture state.
   * landmarks: array of {x, y, z} normalized 0-1
   */
  detect(landmarks) {
    if (!landmarks || landmarks.length < 21) {
      return this._reset();
    }

    const thumbTip  = landmarks[LM.THUMB_TIP];
    const indexTip  = landmarks[LM.INDEX_TIP];
    const middleTip = landmarks[LM.MIDDLE_TIP];
    const ringTip   = landmarks[LM.RING_TIP];
    const pinkyTip  = landmarks[LM.PINKY_TIP];
    const wrist     = landmarks[LM.WRIST];
    const indexMCP  = landmarks[LM.INDEX_MCP];

    // Pinch: thumb-tip to index-tip distance
    const pinchDist = dist2d(thumbTip.x, thumbTip.y, indexTip.x, indexTip.y);

    // Palm "openness": spread of all finger tips from palm center
    const palmCx = (wrist.x + indexMCP.x) / 2;
    const palmCy = (wrist.y + indexMCP.y) / 2;
    const fingerDists = [indexTip, middleTip, ringTip, pinkyTip].map(f =>
      dist2d(f.x, f.y, palmCx, palmCy)
    );
    const avgSpread = fingerDists.reduce((a, b) => a + b, 0) / fingerDists.length;

    // Fist: all fingertips close to palm
    const isFist = fingerDists.every(d => d < this.fistThreshold * 2.5)
                && pinchDist < this.pinchThreshold * 1.8;

    const isPinching = pinchDist < this.pinchThreshold;
    const isOpenPalm = avgSpread > this.openPalmThreshold && !isPinching;

    // Track pinch hold duration
    if (isPinching) {
      this.pinchDuration++;
    } else {
      this.pinchDuration = 0;
    }

    const justPinched  = isPinching  && !this._prevPinch;
    const justReleased = !isPinching && this._prevPinch;

    this._prevPinch = isPinching;
    this.isPinching  = isPinching;
    this.isOpenPalm  = isOpenPalm;
    this.isFist      = isFist;

    return {
      isPinching,
      isOpenPalm,
      isFist,
      justPinched,
      justReleased,
      pinchDist,
      pinchDuration: this.pinchDuration,
      avgSpread,
    };
  }

  _reset() {
    this.isPinching = false;
    this.isOpenPalm = false;
    this.isFist = false;
    this._prevPinch = false;
    this.pinchDuration = 0;
    return {
      isPinching: false, isOpenPalm: false, isFist: false,
      justPinched: false, justReleased: false,
      pinchDist: 1, pinchDuration: 0, avgSpread: 0,
    };
  }

  /**
   * Extract key landmark positions in canvas space.
   */
  static extractPoints(landmarks, canvasW, canvasH) {
    if (!landmarks || landmarks.length < 21) return null;

    const toC = (lm) => mpToCanvas(lm.x, lm.y, canvasW, canvasH);

    const thumbTip  = toC(landmarks[LM.THUMB_TIP]);
    const indexTip  = toC(landmarks[LM.INDEX_TIP]);
    const wrist     = toC(landmarks[LM.WRIST]);
    const indexMCP  = toC(landmarks[LM.INDEX_MCP]);
    const middleMCP = toC(landmarks[LM.MIDDLE_MCP]);

    // Palm center: midpoint of wrist and middle-MCP
    const palmCenter = {
      x: (wrist.x + middleMCP.x) / 2,
      y: (wrist.y + middleMCP.y) / 2,
    };

    // Pinch midpoint
    const pinchMid = {
      x: (thumbTip.x + indexTip.x) / 2,
      y: (thumbTip.y + indexTip.y) / 2,
    };

    return { thumbTip, indexTip, palmCenter, pinchMid, wrist, indexMCP };
  }
}
