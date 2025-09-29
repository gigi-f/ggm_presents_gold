/*
 AI-INDEX
 - Tags: ui.framework
 - See: docs/ai/index.json
*/

export type ModalSpec = {
  coverHUD?: boolean;
  depthBase?: number;
  outerMargin?: number;
  padX?: number;
  padTop?: number;
  padBottom?: number;
  backdropAlpha?: number;
  backdropColor?: number;
  panelColor?: number;
  panelAlpha?: number;
  panelStrokeColor?: number;
  panelStrokeWidth?: number;
};

export type Modal = {
  backdrop: any;
  panel: any;
  content: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: () => number;
    height: () => number;
    centerX: () => number;
  };
  center: { x: number; y: number };
  size: { w: number; h: number };
  setVisible: (v: boolean) => void;
  destroy: () => void;
};

export function createModal(scene: any, opts: ModalSpec = {}): Modal {
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

  const gameW = scene.worldPixelWidth as number;
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
    setVisible(v: boolean) { nodes.forEach(n => n.setVisible(v)); },
    destroy() { nodes.forEach(n => { try { n.destroy(); } catch {} }); },
  };
}

export function addTitle(scene: any, modal: Modal, text: string, style: any = { fontSize: '12px', color: '#ffffff' }) {
  const t = scene.add.text(modal.center.x, modal.content.top, text, { ...style, wordWrap: { width: modal.content.width() } })
    .setOrigin(0.5, 0)
    .setDepth((modal.panel.depth || 501) + 1);
  return t;
}

export const UI = {
  _open: new Set<string>(),
  open(name: string) { this._open.add(name); },
  close(name: string) { this._open.delete(name); },
  anyOpen() { return this._open.size > 0; },
  names() { return Array.from(this._open.values()); }
};

export function getNodeBounds(node: any) {
  const w = (node.width ?? node.displayWidth ?? 0);
  const h = (node.height ?? node.displayHeight ?? 0);
  const ox = (typeof node.originX === 'number') ? node.originX : (typeof node.displayOriginX === 'number' ? (node.displayOriginX / (w || 1)) : 0.5);
  const oy = (typeof node.originY === 'number') ? node.originY : (typeof node.displayOriginY === 'number' ? (node.displayOriginY / (h || 1)) : 0.5);
  const left = node.x - w * ox;
  const top = node.y - h * oy;
  return { left, top, right: left + w, bottom: top + h, width: w, height: h, centerX: node.x, centerY: node.y };
}

export function clampNodeToContent(node: any, modal: Modal, pad = 0) {
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

export function avoidOverlaps(nodes: any[], modal: Modal, pad = 2) {
  const list = nodes.filter(Boolean);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const A = getNodeBounds(a), B = getNodeBounds(b);
      const overlap = !(A.right + pad <= B.left || B.right + pad <= A.left || A.bottom + pad <= B.top || B.bottom + pad <= A.top);
      if (overlap) {
        const dy = (A.bottom + pad) - B.top;
        b.setY(b.y + dy);
        clampNodeToContent(b, modal, pad);
      }
    }
    clampNodeToContent(list[i], modal, pad);
  }
}

export function truncateTextToFit(textObj: any, maxWidth: number, maxLines = 2) {
  if (!textObj || typeof textObj.text !== 'string') return;
  const original = textObj.text as string;
  let s = original;
  const maxH = (textObj.style?.fontSize ? parseInt(textObj.style.fontSize) : 10) * maxLines * 1.3;
  const fits = () => (textObj.width <= maxWidth + 0.5) && (textObj.height <= maxH + 0.5);
  if (fits()) return;
  let cut = s.length;
  while (cut > 1) {
    cut = Math.max(1, Math.floor(cut * 0.9));
    s = original.slice(0, cut) + '…';
    textObj.setText(s);
    if (fits()) return;
  }
  textObj.setText(original.slice(0, 1) + '…');
}
