/*
 AI-INDEX
 - Tags: ui.framework
 - See: docs/ai/index.json
*/

// Thin wrappers around Rex UI to keep call-sites small and theme-aware
import { Theme } from './theme';
// We import only the pieces we use to avoid pulling everything eagerly

// Rex provides UI factory builders via scene.rexUI; we’ll access them dynamically
export function getRex(scene: any) {
  const rex = (scene as any).rexUI;
  if (!rex) {
    console.warn('Rex UI plugin not found on scene');
  }
  return rex;
}

export function makeLabel(scene: any, opts: { text: string; fontSize?: string; padding?: number; bgColor?: number; align?: string; }) {
  const rex = getRex(scene);
  const pad = opts.padding ?? Theme.spacing.sm;
  const background = scene.add.rectangle(0, 0, 1, 1, opts.bgColor ?? Theme.colors.panel, Theme.alpha.panel).setStrokeStyle(1, Theme.colors.panelStroke);
  const text = scene.add.text(0, 0, opts.text, { fontSize: opts.fontSize ?? Theme.fonts.body, color: Theme.colors.textPrimary, align: opts.align ?? 'center', wordWrap: { width: 0 } });
  return rex?.add?.label({
    background,
    text,
    space: { left: pad, right: pad, top: Math.max(4, pad - 2), bottom: Math.max(4, pad - 2) }
  });
}

export function makeDialog(scene: any, config: { title?: string; content?: string; width?: number }) {
  const rex = getRex(scene);
  const w = config.width ?? Math.floor((scene.worldPixelWidth || scene.scale?.width || 320) * 0.7);
  const title = config.title ? makeLabel(scene, { text: config.title, fontSize: Theme.fonts.title }) : undefined;
  const content = config.content ? scene.add.text(0, 0, config.content, { fontSize: Theme.fonts.body, color: Theme.colors.textPrimary, wordWrap: { width: w - Theme.spacing.lg } }) : undefined;
  const dialog = rex?.add?.dialog({
    x: (scene.scale?.width || scene.worldPixelWidth) / 2,
    y: (scene.scale?.height || (scene.worldPixelHeight + scene.hudHeight)) / 2,
    width: w,
    background: scene.add.rectangle(0, 0, 2, 2, Theme.colors.panel, Theme.alpha.panel).setStrokeStyle(2, Theme.colors.panelStroke),
    title,
    content,
    space: { left: Theme.spacing.md, right: Theme.spacing.md, top: Theme.spacing.md, bottom: Theme.spacing.md, title: Theme.spacing.sm, content: Theme.spacing.md },
    expand: { content: false }
  });
  return dialog;
}

export function makeTextButton(scene: any, label: string, onClick: () => void) {
  const btn = makeLabel(scene, { text: label, fontSize: '10px', padding: 6 });
  btn?.setInteractive?.({ useHandCursor: true })?.on?.('pointerdown', () => onClick());
  return btn;
}

export function showPauseMenuRex(scene: any) {
  if (!getRex(scene)) return null;
  const dlg = makeDialog(scene, { title: 'Paused', content: '' });
  const buttons = [
    makeTextButton(scene, 'Save', () => scene.saveGame?.()),
    makeTextButton(scene, 'Load', () => scene.loadGame?.()),
    makeTextButton(scene, 'Resume', () => scene.closePauseMenu?.())
  ].filter(Boolean);
  dlg?.addActions?.(buttons);
  dlg?.layout?.();
  dlg?.popUp?.(200);
  return dlg;
}

export function showShopDialogRex(scene: any, items: any[], opts: { onClose: () => void; onBuy: (item: any) => boolean; walletText: string; pageSize?: number; }) {
  const rex = getRex(scene); if (!rex) return null;
  const w = Math.floor((scene.worldPixelWidth || scene.scale?.width || 320) * 0.85);
  const dlg = makeDialog(scene, { title: 'Welcome! What would you like to buy?', content: '' });
  dlg.setMinWidth?.(w);
  // Wallet summary
  const wallet = scene.add.text(0, 0, opts.walletText, { fontSize: Theme.fonts.body, color: '#aaddff', wordWrap: { width: w - Theme.spacing.lg } });
  // List container with paging
  const pageSize = Math.max(1, Math.min(opts.pageSize ?? 6, 8));
  let page = 0;
  const getPageCount = () => Math.max(1, Math.ceil(items.length / pageSize));
  const listSizer = rex.add.sizer({ orientation: 'y', space: { item: Theme.spacing.sm } });
  const contentSizer = rex.add.fixWidthSizer({ width: w - Theme.spacing.lg, space: { item: Theme.spacing.xs, line: Theme.spacing.xs } });
  const render = () => {
    contentSizer.clear?.(true);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, items.length);
    for (let i = start, row = 0; i < end; i++, row++) {
      const it = items[i];
      const label = `${(row+1)}. ${it.itemName} - ${it.priceStr}`;
      const t = scene.add.text(0, 0, label, { fontSize: Theme.fonts.body, color: it.affordable ? Theme.colors.accent : Theme.colors.textMuted, wordWrap: { width: w - Theme.spacing.lg } });
      t.setData?.('idx', row);
      contentSizer.add(t);
    }
    listSizer.layout?.(); dlg.layout?.();
  };
  // Navigation + actions row
  const prevBtn = makeTextButton(scene, '◀', () => { if (page > 0) { page--; render(); updatePage(); } });
  const nextBtn = makeTextButton(scene, '▶', () => { if (page + 1 < getPageCount()) { page++; render(); updatePage(); } });
  const closeBtn = makeTextButton(scene, 'Close', () => { try { dlg.destroy?.(); } catch {} opts.onClose?.(); });
  const actions = rex.add.sizer({ orientation: 'x', space: { item: Theme.spacing.sm } }).add(prevBtn).add(nextBtn).add(closeBtn);
  const pageText = scene.add.text(0, 0, '', { fontSize: Theme.fonts.small, color: Theme.colors.textMuted });
  const updatePage = () => { pageText.setText(`Page ${page+1}/${getPageCount()}`); };
  // Assemble dialog content
  listSizer.add(wallet).add(contentSizer).add(pageText).add(actions);
  dlg.add?.(listSizer); dlg.layout?.(); dlg.popUp?.(200);
  // Input: map 1-6 to buy current page item
  const onKey = (e: KeyboardEvent) => {
    const map: any = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };
    if (e.code === 'Escape' || e.code === 'KeyC') { cleanup(); return; }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { prevBtn.emit?.('pointerdown'); return; }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') { nextBtn.emit?.('pointerdown'); return; }
    if (!(e.code in map)) return;
    const idx = map[e.code];
    const global = page * pageSize + idx;
    const choice = items[global];
    if (!choice) return;
    const ok = opts.onBuy(choice);
    if (!ok) return;
    cleanup();
  };
  const cleanup = () => {
    try { scene.input.keyboard.off('keydown', onKey); } catch {}
    try { dlg.destroy?.(); } catch {}
    opts.onClose?.();
  };
  scene.input.keyboard.on('keydown', onKey);
  updatePage(); render();
  return dlg;
}
