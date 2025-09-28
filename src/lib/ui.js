/*
 AI-INDEX
 - Tags: ui.framework
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';

/**
 * createModal(scene, opts)
 * Builds a centered modal (backdrop + panel) sized to the gameplay area (excludes HUD),
 * with standardized outer margins and inner padding. Returns helpers and content bounds.
 *
 * opts: {
 *   coverHUD?: boolean, // default false; if true covers entire canvas height
 *   depthBase?: number, // default 500
 *   outerMargin?: number, // default 12
 *   padX?: number, // default 14
 *   padTop?: number, // default 12
 *   padBottom?: number, // default 12
 *   backdropAlpha?: number, // default 0.55
 *   backdropColor?: number, // default 0x000000
 *   panelColor?: number, // default 0x222222
 *   panelAlpha?: number, // default 0.95
 *   panelStrokeColor?: number, // default 0xffffff
 *   panelStrokeWidth?: number // default 2
 * }
 */
export function createModal(scene, opts = {}) {
  const {
    coverHUD = false,
    depthBase = 500,
    outerMargin = 12,
    padX = 14,
    padTop = 12,
    padBottom = 12,
    backdropAlpha = 0.55,
    backdropColor = 0x000000,
    panelColor = 0x222222,
    panelAlpha = 0.95,
    panelStrokeColor = 0xffffff,
    panelStrokeWidth = 2,
  } = opts;

  const gameW = scene.worldPixelWidth;
  const gameH = coverHUD ? (scene.scale?.height || scene.worldPixelHeight + scene.hudHeight) : scene.worldPixelHeight;
  const cx = gameW / 2;
  const cy = gameH / 2;

  const backdrop = scene.add.rectangle(cx, cy, gameW, gameH, backdropColor, backdropAlpha).setDepth(depthBase);
  const panelW = gameW - (outerMargin * 2);
  const panelH = gameH - (outerMargin * 2);
  const panel = scene.add.rectangle(cx, cy, panelW, panelH, panelColor, panelAlpha)
    .setStrokeStyle(panelStrokeWidth, panelStrokeColor)
    .setDepth(depthBase + 1);

  const content = {
    left: cx - (panelW / 2) + padX,
    right: cx + (panelW / 2) - padX,
    top: cy - (panelH / 2) + padTop,
    bottom: cy + (panelH / 2) - padBottom,
    width: () => Math.max(0, (cx + (panelW / 2) - padX) - (cx - (panelW / 2) + padX)),
    height: () => Math.max(0, (cy + (panelH / 2) - padBottom) - (cy - (panelH / 2) + padTop)),
    centerX: () => cx,
  };

  const nodes = [backdrop, panel];
  return {
    backdrop,
    panel,
    content,
    center: { x: cx, y: cy },
    size: { w: gameW, h: gameH },
    setVisible(v) { nodes.forEach(n => n.setVisible(v)); },
    destroy() { nodes.forEach(n => { try { n.destroy(); } catch {} }); },
  };
}

/**
 * addTitle(scene, modal, text, style?) - places a centered title at the top of the modal content area.
 */
export function addTitle(scene, modal, text, style = { fontSize: '12px', color: '#ffffff' }) {
  const t = scene.add.text(modal.center.x, modal.content.top, text, { ...style, wordWrap: { width: modal.content.width() } })
    .setOrigin(0.5, 0)
    .setDepth((modal.panel.depth || 501) + 1);
  return t;
}

// Simple global UI registry to manage open UIs and input gating
export const UI = {
  _open: new Set(),
  open(name) { this._open.add(name); },
  close(name) { this._open.delete(name); },
  anyOpen() { return this._open.size > 0; },
  names() { return Array.from(this._open.values()); }
};
