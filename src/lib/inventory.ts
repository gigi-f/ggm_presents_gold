/*
 AI-INDEX
 - Tags: mechanics.inventory
 - See: docs/ai/index.json
*/
import { SCENES } from './constants';
import { createModal, addTitle, UI, clampNodeToContent, avoidOverlaps, truncateTextToFit } from './ui';
import * as World from './world';

// --- Helpers: categorization and descriptions ---
function categorizeItem(item: any): 'weapons' | 'shields' | 'potions' | 'other' {
  if (!item) return 'other';
  if (item.type === 'weapon') return 'weapons';
  if (item.type === 'shield') return 'shields';
  if (item.type === 'consumable') return 'potions';
  return 'other';
}

const TAB_ORDER = ['weapons', 'shields', 'potions', 'other'] as const;
const TAB_LABELS: Record<string, string> = { weapons: 'Weapons', shields: 'Shields', potions: 'Potions', other: 'Other' };

function getItemDescription(item: any): string {
  if (!item) return 'Unknown item.';
  if (item.type === 'weapon') {
    const base: Record<string, string> = {
      starter: 'A rusty starter pickaxe. Weak but reliable.',
      basic: 'A basic melee weapon. Balanced for general use.',
      strong: 'A heavy weapon that deals strong hits but is slower.',
      fast: 'A light weapon that swings quickly but for less damage.'
    };
    return base[item.subtype] || `A ${item.subtype || 'melee'} weapon.`;
  }
  if (item.type === 'shield') {
    const base: Record<string, string> = {
      basic: 'A basic wooden shield. Modest protection.',
      strong: 'A sturdy metal shield. High protection, heavier.',
      light: 'A light buckler. Quicker to raise, less protection.'
    };
    return base[item.subtype] || `A ${item.subtype || 'basic'} shield.`;
  }
  if (item.type === 'consumable') {
    const parts: string[] = [];
    if (item.healAmount) parts.push(`Restores ${item.healAmount} HP`);
    if (item.staminaAmount) parts.push(`Restores ${item.staminaAmount} Stamina`);
    return (item.description) || (parts.length ? parts.join(' and ') + '.' : 'A consumable item.');
  }
  return item.description || 'An item.';
}

export function addToInventory(scene: any, item: any): boolean {
  if (scene.inventoryItems.length >= scene.maxInventorySize) return false;
  scene.inventoryItems.push(item);
  try { updateInventoryDisplay(scene); } catch {}
  return true;
}

export function removeFromInventory(scene: any, index: number): any {
  if (index >= 0 && index < scene.inventoryItems.length) return scene.inventoryItems.splice(index, 1)[0];
  return null;
}

export function equipFromInventory(scene: any, index: number): void {
  if (index >= scene.inventoryItems.length) { console.log('No item in that slot'); return; }
  const item = scene.inventoryItems[index];
  if (item.type === 'weapon') { equipWeapon(scene, item); console.log(`Equipped ${item.name}`); }
  else if (item.type === 'shield') { equipShield(scene, item); console.log(`Equipped ${item.name}`); }
}

export function equipWeapon(scene: any, weaponItem: any): void {
  if (scene.equippedWeapon) { /* potential swap */ }
  scene.equippedWeapon = weaponItem;
  scene.hasMeleeWeapon = true;
  scene.meleeWeaponType = weaponItem.subtype;
  scene.meleeWeaponName = weaponItem.name;
  const uiScene = scene.scene.get(SCENES.UI);
  if (uiScene && uiScene.scene.isActive()) uiScene.updateWeaponDisplay({ name: weaponItem.name, type: weaponItem.subtype });
}

export function equipShield(scene: any, shieldItem: any): void {
  if (scene.equippedShield) { /* potential swap */ }
  scene.equippedShield = shieldItem;
  scene.hasShield = true;
  scene.shieldType = shieldItem.subtype;
  scene.shieldName = shieldItem.name;
  const uiScene = scene.scene.get(SCENES.UI);
  if (uiScene && uiScene.scene.isActive()) uiScene.updateShieldDisplay({ name: shieldItem.name, type: shieldItem.subtype });
}

export function toggleInventory(scene: any): void {
  scene.inventoryOpen = !scene.inventoryOpen;
  if (scene.inventoryOpen) showInventory(scene); else hideInventory(scene);
}

export function showInventory(scene: any): void {
  scene.inventoryOpen = true;
  if (!scene.inventoryPanel) {
    const modal = createModal(scene, { coverHUD: false, depthBase: 400 });
    scene.inventoryModal = modal;
    scene.inventoryBackdrop = modal.backdrop;
    scene.inventoryPanel = modal.panel;
    scene.inventoryTitle = addTitle(scene, modal, 'INVENTORY', { fontSize: '16px', color: '#ffffff' });

    scene._invTabs = [];
    scene._invActiveTab = scene._invActiveTab || 'weapons';
    renderTabs(scene);

    scene._invSections = scene._invSections || { tabs: { top: 0, bottom: 0 }, grid: { top: 0, bottom: 0 } };

    scene._invSlotNodes = [];
    scene._invItemNodes = [];
    scene._invHighlight = null;

    attachInventoryKeyHandlers(scene);
  }
  attachInventoryKeyHandlers(scene);
  if (scene.inventoryBackdrop) scene.inventoryBackdrop.setVisible(true);
  scene.inventoryPanel.setVisible(true);
  scene.inventoryTitle.setVisible(true);
  setTabsVisibility(scene, true);
  setGridVisibility(scene, true);
  renderTabs(scene);
  refreshInventoryGrid(scene);
  UI.open('inventory');
}

export function hideInventory(scene: any): void {
  scene.inventoryOpen = false;
  if (!scene.inventoryPanel) return;
  if (scene.inventoryBackdrop) scene.inventoryBackdrop.setVisible(false);
  scene.inventoryPanel.setVisible(false);
  scene.inventoryTitle.setVisible(false);
  setTabsVisibility(scene, false);
  setGridVisibility(scene, false);
  closeSubmenu(scene);
  if (scene._invInspectNodes) { try { scene._invInspectNodes.forEach((n: any) => n.destroy()); } catch {} scene._invInspectNodes = null; }
  detachInventoryKeyHandlers(scene);
  UI.close('inventory');
}

export function updateInventoryDisplay(scene: any): void {
  if (!scene.inventoryOpen || !scene.inventoryPanel || !scene.inventoryPanel.visible) return;
  refreshInventoryGrid(scene);
}

export function updateEquipmentHUD(scene: any): void {
  const uiScene = scene.scene.get(SCENES.UI);
  if (!uiScene || !uiScene.scene.isActive()) { console.log('UIScene not ready for equipment update'); return; }
  console.log('Updating equipment HUD - Weapon:', scene.equippedWeapon?.name, 'Shield:', scene.equippedShield?.name);
  if (scene.equippedWeapon) uiScene.updateWeaponDisplay({ name: scene.equippedWeapon.name, type: scene.equippedWeapon.subtype });
  else uiScene.updateWeaponDisplay({ name: 'None', type: 'none' });
  if (scene.equippedShield) uiScene.updateShieldDisplay({ name: scene.equippedShield.name, type: scene.equippedShield.subtype });
  else uiScene.updateShieldDisplay({ name: 'None', type: 'none' });
}

export function equipDefaultWeapon(scene: any): void {
  const defaultWeapon = { type: 'weapon', subtype: 'starter', name: 'Rusty Pickaxe', color: 0x666666, size: { width: 14, height: 3 }, swingDuration: 350 };
  addToInventory(scene, defaultWeapon);
  equipWeapon(scene, defaultWeapon);
  console.log('Equipped default starter weapon: Rusty Pickaxe');
}

function setTabsVisibility(scene: any, visible: boolean): void {
  if (scene._invTabs) scene._invTabs.forEach((n: any) => n.setVisible(visible));
  if (scene._invBottomHint) scene._invBottomHint.setVisible(visible);
  if (visible && scene._invTabs) scene._invTabs.forEach((n: any) => { if (n?.setInteractive) n.setInteractive({ useHandCursor: true }); });
}

function setGridVisibility(scene: any, visible: boolean): void {
  if (scene._invSlotNodes) scene._invSlotNodes.forEach((n: any) => n.setVisible(visible));
  if (scene._invItemNodes) scene._invItemNodes.forEach((n: any) => n.setVisible(visible));
  if (scene._invHighlight) scene._invHighlight.setVisible(visible);
}

function renderTabs(scene: any): void {
  if (scene._invTabs) { scene._invTabs.forEach((n: any) => { try { n.destroy(); } catch {} }); scene._invTabs = []; }
  const modal = scene.inventoryModal;
  const top = modal.content.top + 18;
  let x = modal.content.left + 6;
  let maxBottom = top;
  (TAB_ORDER as readonly string[]).forEach((tabKey: string) => {
    const label = TAB_LABELS[tabKey];
    const isActive = scene._invActiveTab === tabKey;
    const txt = scene.add.text(x, top, label, { fontSize: '11px', color: isActive ? '#ffffaa' : '#dddddd' }).setDepth(411);
    scene._invTabs.push(txt);
    const w = txt.width; const u = scene.add.rectangle(x + w/2, top + txt.height + 2, w, 1, isActive ? 0xffffaa : 0x666666).setDepth(411);
    scene._invTabs.push(u);
    txt.setInteractive({ useHandCursor: true });
    txt.on('pointerdown', () => { scene._invActiveTab = tabKey; refreshInventoryGrid(scene); renderTabs(scene); });
    x += w + 14;
    maxBottom = Math.max(maxBottom, top + txt.height + 3);
  });
  if (scene._invBottomHint) { try { scene._invBottomHint.destroy(); } catch {} }
  const bottomHintText = 'A/D to switch tabs • Arrows to move • C to select';
  scene._invBottomHint = scene.add.text(modal.center.x, modal.content.bottom - 2, bottomHintText, { fontSize: '9px', color: '#aaaaaa' })
    .setDepth(411)
    .setOrigin(0.5, 1);
  scene._invTabs.forEach((n: any) => clampNodeToContent(n, modal, 2));
  avoidOverlaps(scene._invTabs, modal, 2);
  scene._invTabsBottomY = maxBottom;

  scene._invSections = scene._invSections || { tabs: { top: 0, bottom: 0 }, grid: { top: 0, bottom: 0 }, bottom: { top: 0, bottom: 0 } };
  scene._invSections.tabs.top = modal.content.top;
  scene._invSections.tabs.bottom = maxBottom + 4;
  const bh = Math.ceil(scene._invBottomHint?.height || 12);
  scene._invSections.bottom.top = modal.content.bottom - (bh + 2);
  scene._invSections.bottom.bottom = modal.content.bottom;
}

function getFilteredIndices(scene: any): number[] {
  const tab = scene._invActiveTab || 'weapons';
  const out: number[] = [];
  for (let i = 0; i < scene.inventoryItems.length; i++) {
    const it = scene.inventoryItems[i];
    if (categorizeItem(it) === tab) out.push(i);
  }
  return out;
}

function gridMetrics(scene: any) {
  const modal = scene.inventoryModal;
  const cols = 4;
  const slotW = 38, slotH = 38, gutter = 8;
  const startX = modal.content.left + 10;
  const minY = (scene._invTabsBottomY || (modal.content.top + 18 + 14)) + 14;
  const startY = Math.max(modal.content.top + 44, minY);
  scene._invSections = scene._invSections || { tabs: { top: 0, bottom: 0 }, grid: { top: 0, bottom: 0 }, bottom: { top: 0, bottom: 0 } };
  scene._invSections.grid.top = startY - 2;
  const bottomLimit = Math.min(modal.content.bottom, (scene._invSections.bottom?.top ?? modal.content.bottom) - 4);
  scene._invSections.grid.bottom = bottomLimit;
  return { cols, slotW, slotH, gutter, startX, startY };
}

function slotPosition(m: any, idx: number) {
  const row = Math.floor(idx / m.cols);
  const col = idx % m.cols;
  const x = m.startX + col * (m.slotW + m.gutter);
  const y = m.startY + row * (m.slotH + m.gutter + 10);
  return { x, y };
}

function refreshInventoryGrid(scene: any): void {
  if (!scene.inventoryOpen || !scene.inventoryPanel || !scene.inventoryPanel.visible) return;
  if (scene._invSlotNodes) { scene._invSlotNodes.forEach((n: any) => { try { n.destroy(); } catch {} }); scene._invSlotNodes = []; }
  if (scene._invItemNodes) { scene._invItemNodes.forEach((n: any) => { try { n.destroy(); } catch {} }); scene._invItemNodes = []; }
  if (scene._invHighlight) { try { scene._invHighlight.destroy(); } catch {} scene._invHighlight = null; }

  scene._invFiltered = getFilteredIndices(scene);
  const count = scene._invFiltered.length;
  const m = gridMetrics(scene);

  if (count === 0) scene._invHover = -1;
  else if (scene._invHover == null || scene._invHover < 0 || scene._invHover >= count) scene._invHover = 0;

  for (let i = 0; i < Math.max(1, count); i++) {
    const pos = slotPosition(m, i);
    const slot = scene.add.rectangle(pos.x, pos.y, m.slotW, m.slotH, 0x333333, 0.7).setDepth(412);
    scene._invSlotNodes.push(slot);
    if (i < count) {
      const item = scene.inventoryItems[scene._invFiltered[i]];
      const isEquipped = (scene.equippedWeapon && scene.equippedWeapon === item) || (scene.equippedShield && scene.equippedShield === item);
      let icon: any;
      if (item.type === 'weapon') icon = scene.add.rectangle(pos.x, pos.y, Math.max(6, Math.round((item.size?.width || 16)/2)), Math.max(8, Math.round((item.size?.height || 4)*2)), item.color || 0xaaaaaa);
      else if (item.type === 'shield') icon = scene.add.rectangle(pos.x, pos.y, Math.max(8, Math.round(item.size?.width || 12)), Math.max(10, Math.round(item.size?.height || 16)), item.color || 0xaaaaaa);
      else icon = scene.add.rectangle(pos.x, pos.y, 10, 10, 0xaaaaaa);
      icon.setDepth(413);
      let label = scene.add.text(pos.x, pos.y + m.slotH/2 + 2, item.name || 'Item', { fontSize: '8px', color: isEquipped ? '#00ff00' : '#ffffff', align: 'center', wordWrap: { width: m.slotW - 6 } })
        .setOrigin(0.5, 0)
        .setDepth(413);
      truncateTextToFit(label, m.slotW - 8, 2);
      scene._invItemNodes.push(icon, label);
      slot.setFillStyle(isEquipped ? 0x004400 : 0x333333, isEquipped ? 0.8 : 0.7);
    } else {
      const label = scene.add.text(pos.x, pos.y, 'Empty', { fontSize: '8px', color: '#888888' }).setOrigin(0.5, 0.5).setDepth(413);
      scene._invItemNodes.push(label);
    }
  }
  const modal = scene.inventoryModal;
  const allNodes = [...scene._invSlotNodes, ...scene._invItemNodes];
  allNodes.forEach((n: any) => { clampNodeToContent(n, modal, 2); clampNodeToVerticalBand(n, modal, scene._invSections?.grid); });

  if (count > 0) {
    const pos = slotPosition(m, scene._invHover);
    scene._invHighlight = scene.add.rectangle(pos.x, pos.y, m.slotW + 4, m.slotH + 4).setStrokeStyle(2, 0xffff66).setDepth(414);
    clampNodeToContent(scene._invHighlight, scene.inventoryModal, 2);
    clampNodeToVerticalBand(scene._invHighlight, scene.inventoryModal, scene._invSections?.grid);
  }
}

function clampNodeToVerticalBand(node: any, modal: any, band: any): void {
  if (!band) return;
  const pad = 2;
  const minY = Math.max(modal.content.top + pad, band.top);
  const maxY = Math.min(modal.content.bottom - pad, band.bottom);
  const h = (node.height ?? node.displayHeight ?? 0);
  const oy = (typeof node.originY === 'number') ? node.originY : (typeof node.displayOriginY === 'number' ? (node.displayOriginY / (h || 1)) : 0.5);
  const top = node.y - h * oy;
  const bottom = top + h;
  let ny = node.y;
  if (top < minY) ny += (minY - top);
  if (bottom > maxY) ny -= (bottom - maxY);
  if (ny !== node.y) node.setY(ny);
}

function attachInventoryKeyHandlers(scene: any): void {
  if (scene._invKeyHandler) { try { scene.input.keyboard.off('keydown', scene._invKeyHandler); } catch {} }
  const handler = (e: any) => {
    if (!scene.inventoryOpen) return;
    if (scene._invInspectNodes) return;
    const code = e.code;
    if (scene._invMenuOpen) { handleSubmenuKey(scene, e); return; }
    if (code === 'KeyA') { prevTab(scene); e.preventDefault?.(); return; }
    if (code === 'KeyD') { nextTab(scene); e.preventDefault?.(); return; }
    if (code === 'ArrowLeft') { moveHover(scene, -1, 0); e.preventDefault?.(); return; }
    if (code === 'ArrowRight') { moveHover(scene, 1, 0); e.preventDefault?.(); return; }
    if (code === 'ArrowUp') { moveHover(scene, 0, -1); e.preventDefault?.(); return; }
    if (code === 'ArrowDown') { moveHover(scene, 0, 1); e.preventDefault?.(); return; }
    if (code === 'KeyC' || code === 'Enter' || code === 'Space') { openSubmenu(scene); e.preventDefault?.(); return; }
  };
  scene._invKeyHandler = handler;
  scene.input.keyboard.on('keydown', handler);
}

function detachInventoryKeyHandlers(scene: any): void {
  if (!scene._invKeyHandler) return;
  try { scene.input.keyboard.off('keydown', scene._invKeyHandler); } catch {}
  scene._invKeyHandler = null;
}

function prevTab(scene: any): void {
  const i = TAB_ORDER.indexOf(scene._invActiveTab || 'weapons');
  scene._invActiveTab = TAB_ORDER[(i - 1 + TAB_ORDER.length) % TAB_ORDER.length];
  renderTabs(scene); refreshInventoryGrid(scene);
}
function nextTab(scene: any): void {
  const i = TAB_ORDER.indexOf(scene._invActiveTab || 'weapons');
  scene._invActiveTab = TAB_ORDER[(i + 1) % TAB_ORDER.length];
  renderTabs(scene); refreshInventoryGrid(scene);
}

function moveHover(scene: any, dx: number, dy: number): void {
  const m = gridMetrics(scene);
  const count = scene._invFiltered?.length || 0;
  if (count <= 0) { scene._invHover = -1; return; }
  let r = Math.max(0, Math.floor((scene._invHover || 0) / m.cols));
  let c = Math.max(0, (scene._invHover || 0) % m.cols);
  r += dy; c += dx;
  const lastIdx = count - 1;
  const maxRow = Math.floor(lastIdx / m.cols);
  if (r < 0) r = 0; if (r > maxRow) r = maxRow;
  const rowCount = (r < maxRow) ? m.cols : ((lastIdx % m.cols) + 1);
  if (c < 0) c = 0; if (c > rowCount - 1) c = rowCount - 1;
  scene._invHover = Math.min(lastIdx, r * m.cols + c);
  if (scene._invHighlight) {
    const pos = slotPosition(m, scene._invHover);
    scene._invHighlight.setPosition(pos.x, pos.y);
    clampNodeToContent(scene._invHighlight, scene.inventoryModal, 2);
    clampNodeToVerticalBand(scene._invHighlight, scene.inventoryModal, scene._invSections?.grid);
  }
}

function openSubmenu(scene: any): void {
  if (!scene._invFiltered || (scene._invHover ?? -1) < 0) return;
  const idx = scene._invFiltered[scene._invHover];
  const item = scene.inventoryItems[idx];
  if (!item) return;
  const isConsumable = item.type === 'consumable';
  const options = isConsumable ? ['Inspect', 'Use', 'Drop'] : ['Inspect', 'Equip', 'Drop'];
  try { if (scene._invTabs) { scene._invTabs.forEach((n: any) => { if (n?.input) n.disableInteractive(); }); } } catch {}
  const zBase = (scene.inventoryModal?.panel?.depth ?? 401);
  if (!scene._invInputBlocker) {
    const modal = scene.inventoryModal;
    const bw = modal?.size?.w ?? (scene.scale?.width || 0);
    const bh = modal?.size?.h ?? (scene.scale?.height || 0);
    const bx = modal?.center?.x ?? (bw / 2);
    const by = modal?.center?.y ?? (bh / 2);
    scene._invInputBlocker = scene.add.rectangle(bx, by, bw, bh, 0x000000, 0.001)
      .setDepth(zBase + 98)
      .setScrollFactor?.(0) || scene._invInputBlocker;
    scene._invInputBlocker.setInteractive({ useHandCursor: false });
    scene._invInputBlocker.on('pointerdown', (e: any) => { e?.stopPropagation?.(); });
  } else {
    scene._invInputBlocker.setDepth(zBase + 98).setVisible(true);
  }
  const m = gridMetrics(scene); const pos = slotPosition(m, scene._invHover);
  const w = 90, lineH = 14; const h = options.length * lineH + 8;
  const x = pos.x + m.slotW / 2 + 8; const y = pos.y;
  const bg = scene.add.rectangle(x, y, w, h, 0x000000, 0.92)
    .setStrokeStyle(1, 0xffffff)
    .setDepth(zBase + 100)
    .setOrigin(0, 0.5);
  const nodes: any[] = [bg];
  const labels: any[] = [];
  let selected = 0;
  for (let i = 0; i < options.length; i++) {
    const t = scene.add.text(x + 6, y - h/2 + 4 + i * lineH, options[i], { fontSize: '10px', color: i === selected ? '#ffff66' : '#ffffff' })
      .setDepth(zBase + 101)
      .setOrigin(0, 0);
    nodes.push(t); labels.push(t);
  }
  scene._invMenu = { bg, nodes, labels, options, selected, idx };
  scene._invMenuOpen = true;
  clampNodeToContent(bg, scene.inventoryModal, 2);
  clampNodeToVerticalBand(bg, scene.inventoryModal, scene._invSections?.grid);
  const dy = bg.y - y;
  if (Math.abs(dy) > 0.01) labels.forEach((t: any) => t.setY(t.y + dy));
  avoidOverlaps([bg], scene.inventoryModal, 2);
}

function closeSubmenu(scene: any): void {
  if (!scene._invMenuOpen) return;
  const { nodes } = scene._invMenu || {};
  if (nodes) nodes.forEach((n: any) => { try { n.destroy(); } catch {} });
  scene._invMenu = null; scene._invMenuOpen = false;
  try { if (scene._invTabs) scene._invTabs.forEach((n: any) => { if (n?.setInteractive) n.setInteractive({ useHandCursor: true }); }); } catch {}
  if (scene._invInputBlocker) { try { scene._invInputBlocker.destroy(); } catch {} scene._invInputBlocker = null; }
}

function handleSubmenuKey(scene: any, e: any): void {
  const menu = scene._invMenu; if (!menu) { scene._invMenuOpen = false; return; }
  const code = e.code;
  if (code === 'Escape') { closeSubmenu(scene); e.preventDefault?.(); return; }
  if (code === 'ArrowUp') { menu.selected = (menu.selected - 1 + menu.options.length) % menu.options.length; redrawSubmenu(scene); e.preventDefault?.(); return; }
  if (code === 'ArrowDown') { menu.selected = (menu.selected + 1) % menu.options.length; redrawSubmenu(scene); e.preventDefault?.(); return; }
  if (code === 'KeyC' || code === 'Enter' || code === 'Space') { applyMenuAction(scene); e.preventDefault?.(); return; }
}

function redrawSubmenu(scene: any): void {
  const { labels, selected } = scene._invMenu || {};
  if (!labels) return;
  for (let i = 0; i < labels.length; i++) { labels[i].setColor(i === selected ? '#ffff66' : '#ffffff'); }
}

function applyMenuAction(scene: any): void {
  const menu = scene._invMenu; if (!menu) return;
  const idx = menu.idx; const item = scene.inventoryItems[idx];
  const choice = menu.options[menu.selected];
  closeSubmenu(scene);
  if (!item) return;
  if (choice === 'Inspect') { openInspectPanel(scene, item); return; }
  if (choice === 'Equip') {
    if (item.type === 'weapon') equipWeapon(scene, item);
    else if (item.type === 'shield') equipShield(scene, item);
    refreshInventoryGrid(scene);
    scene.updateEquipmentHUD?.();
    return;
  }
  if (choice === 'Use') {
    if (item.type === 'consumable') {
      if (item.healAmount) scene.heal?.(item.healAmount);
      if (item.staminaAmount) { scene.stamina = Math.min(scene.maxStamina || 100, (scene.stamina || 0) + item.staminaAmount); scene.scene.get(SCENES.UI)?.updateStaminaBar?.(Math.round(scene.stamina), scene.maxStamina || 100); }
      removeFromInventory(scene, idx);
      refreshInventoryGrid(scene);
      return;
    }
  }
  if (choice === 'Drop') {
    if (scene.equippedWeapon === item) scene.equippedWeapon = null;
    if (scene.equippedShield === item) scene.equippedShield = null;
    const snapshot = { ...item };
    removeFromInventory(scene, idx);
    try { dropItemNextToPlayer(scene, snapshot); } catch {}
    scene.updateEquipmentHUD?.();
    refreshInventoryGrid(scene);
  }
}

export function dropItemNextToPlayer(scene: any, item: any): boolean {
  if (!scene || !scene.player || !item) return false;
  const center = { x: scene.player.x, y: scene.player.y };
  const { gridX: gx, gridY: gy } = World.worldToGrid(scene, center.x, center.y);
  const dir = scene.lastDirection || 'right';
  const order = (() => {
    switch (dir) {
      case 'left': return [[-1,0],[0,-1],[0,1],[1,0]];
      case 'up': return [[0,-1],[1,0],[-1,0],[0,1]];
      case 'down': return [[0,1],[1,0],[-1,0],[0,-1]];
      case 'right':
      default: return [[1,0],[0,-1],[0,1],[-1,0]];
    }
  })();
  let placed: any = null;
  for (const [dx, dy] of order) {
    const tx = gx + dx; const ty = gy + dy;
    if (!World.isGridCellAvailable(scene, tx, ty)) continue;
    const type = item.type;
    let objectType: string | null = null; const extra: any = {};
    if (type === 'weapon') {
      objectType = 'weapon';
      extra.width = Math.round(item.size?.width || 20);
      extra.height = Math.round(item.size?.height || 4);
      extra.color = item.color || 0x888888;
      extra.weaponType = item.subtype || 'basic';
      extra.weaponName = item.name || 'Weapon';
    } else if (type === 'shield') {
      objectType = 'shield';
      extra.width = Math.round(item.size?.width || 12);
      extra.height = Math.round(item.size?.height || 16);
      extra.color = item.color || 0x654321;
      extra.shieldType = item.subtype || 'basic';
      extra.shieldName = item.name || 'Shield';
    } else if (type === 'consumable') {
      objectType = 'consumable';
      extra.width = Math.round(item.size?.width || 6);
      extra.height = Math.round(item.size?.height || 10);
      extra.color = item.color || 0xFF6666;
      extra.consumableType = item.consumableType || item.subtype || 'consumable';
      extra.consumableName = item.name || 'Consumable';
      extra.healAmount = item.healAmount || 0;
      extra.staminaAmount = item.staminaAmount || 0;
    }
    if (!objectType) continue;
    const obj = World.placeObjectOnGrid(scene, tx, ty, objectType, null, extra);
    if (obj) {
      placed = obj;
      obj.isDroppedItem = true;
      obj.itemType = type;
      obj.itemSubtype = item.subtype || extra.weaponType || extra.shieldType || extra.consumableType;
      obj.itemName = item.name || extra.weaponName || extra.shieldName || extra.consumableName;
      obj._invItemSnapshot = { ...item };
      obj.setDepth?.(1);
      if (!scene.droppedItemsGroup && scene.add) scene.droppedItemsGroup = scene.add.group();
      try { scene.droppedItemsGroup.add(obj); } catch {}
      if (scene.worldLayer) try { scene.worldLayer.add(obj); } catch {}
      try { scene.tweens.add({ targets: obj, y: obj.y - 4, yoyo: true, duration: 120 }); } catch {}
      break;
    }
  }
  if (!placed) {
    try {
      World.findNearestFreeWorldPosition(scene, center.x, center.y, { maxRadius: 3 });
      return dropItemNextToPlayer(scene, item);
    } catch {}
  }
  if (placed && scene.showToast) scene.showToast(`Dropped ${placed.itemName || item.name || 'item'}`);
  return !!placed;
}

function openInspectPanel(scene: any, item: any): void {
  if (scene._invInspectNodes) { try { scene._invInspectNodes.forEach((n: any) => n.destroy()); } catch {} }
  const modal = scene.inventoryModal;
  const w = Math.min(180, modal.content.width());
  const h = 90;
  const x = modal.center.x; const y = modal.center.y;
  const bg = scene.add.rectangle(x, y, w, h, 0x111111, 0.95).setStrokeStyle(1, 0xffffff).setDepth(430);
  const title = scene.add.text(x, y - h/2 + 6, item.name || 'Item', { fontSize: '12px', color: '#ffffaa' }).setOrigin(0.5, 0).setDepth(431);
  const desc = scene.add.text(x, y - h/2 + 24, getItemDescription(item), { fontSize: '10px', color: '#ffffff', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5, 0).setDepth(431);
  const hint = scene.add.text(x, y + h/2 - 6, 'C/ESC to close', { fontSize: '9px', color: '#cccccc' }).setOrigin(0.5, 1).setDepth(431);
  scene._invInspectNodes = [bg, title, desc, hint];
  [bg, title, desc, hint].forEach((n: any) => clampNodeToContent(n, scene.inventoryModal, 2));
  const closer = (e: any) => {
    if (e.code === 'KeyC' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
      try { scene.input.keyboard.off('keydown', closer); } catch {}
      if (scene._invInspectNodes) { scene._invInspectNodes.forEach((n: any) => { try { n.destroy(); } catch {} }); scene._invInspectNodes = null; }
      e.preventDefault?.();
    }
  };
  scene.input.keyboard.on('keydown', closer);
}
