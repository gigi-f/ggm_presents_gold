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

// -------- Layout helpers: bounds, clamping, overlap avoidance, truncation --------

// Compute axis-aligned bounds for a Phaser GameObject (approximate using width/height and origin)
export function getNodeBounds(node) {
  const w = (node.width ?? node.displayWidth ?? 0);
  const h = (node.height ?? node.displayHeight ?? 0);
  const ox = (typeof node.originX === 'number') ? node.originX : (typeof node.displayOriginX === 'number' ? (node.displayOriginX / (w || 1)) : 0.5);
  const oy = (typeof node.originY === 'number') ? node.originY : (typeof node.displayOriginY === 'number' ? (node.displayOriginY / (h || 1)) : 0.5);
  const left = node.x - w * ox;
  const top = node.y - h * oy;
  return { left, top, right: left + w, bottom: top + h, width: w, height: h, centerX: node.x, centerY: node.y };
}

export function clampNodeToContent(node, modal, pad = 0) {
  const b = getNodeBounds(node);
  const minX = modal.content.left + pad;
  const maxX = modal.content.right - pad;
  const minY = modal.content.top + pad;
  const maxY = modal.content.bottom - pad;
  let nx = node.x, ny = node.y;
  if (b.left < minX) nx += (minX - b.left);
  if (b.right > maxX) nx -= (b.right - maxX);
  if (b.top < minY) ny += (minY - b.top);
  if (b.bottom > maxY) ny -= (b.bottom - maxY);
  if (nx !== node.x || ny !== node.y) node.setPosition(nx, ny);
}

// Move later nodes down minimally to resolve pairwise overlaps (greedy), then clamp to content
export function avoidOverlaps(nodes, modal, pad = 2) {
  const list = nodes.filter(Boolean);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const A = getNodeBounds(a), B = getNodeBounds(b);
      const overlap = !(A.right + pad <= B.left || B.right + pad <= A.left || A.bottom + pad <= B.top || B.bottom + pad <= A.top);
      if (overlap) {
        // Push b down by minimal amount
        const dy = (A.bottom + pad) - B.top;
        b.setY(b.y + dy);
        clampNodeToContent(b, modal, pad);
      }
    }
    clampNodeToContent(list[i], modal, pad);
  }
}

// Truncate text with ellipsis until it fits within maxWidth and maxLines (approximate)
export function truncateTextToFit(textObj, maxWidth, maxLines = 2) {
  if (!textObj || typeof textObj.text !== 'string') return;
  const original = textObj.text;
  let s = original;
  const lineHeight = textObj.height || 0; // Phaser doesn't expose lineHeight directly without a style measurement
  const maxH = (textObj.style?.fontSize ? parseInt(textObj.style.fontSize) : 10) * maxLines * 1.3; // rough cap
  const fits = () => (textObj.width <= maxWidth + 0.5) && (textObj.height <= maxH + 0.5);
  // Fast path: if already fits, keep
  if (fits()) return;
  // Iteratively shrink
  let cut = s.length;
  while (cut > 1) {
    cut = Math.max(1, Math.floor(cut * 0.9));
    s = original.slice(0, cut) + '…';
    textObj.setText(s);
    if (fits()) return;
  }
  // As a last resort, empty to avoid overlap
  textObj.setText(original.slice(0, 1) + '…');
}
