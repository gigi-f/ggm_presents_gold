/*
 AI-INDEX
 - Tags: mechanics.inventory
 - See: docs/ai/index.json
*/
import { SCENES } from './constants';
import { createModal, addTitle, UI } from './ui';

export function addToInventory(scene, item) {
  if (scene.inventoryItems.length >= scene.maxInventorySize) return false;
  scene.inventoryItems.push(item);
  return true;
}

export function removeFromInventory(scene, index) {
  if (index >= 0 && index < scene.inventoryItems.length) return scene.inventoryItems.splice(index, 1)[0];
  return null;
}

export function equipFromInventory(scene, index) {
  if (index >= scene.inventoryItems.length) {
    console.log('No item in that slot');
    return;
  }
  const item = scene.inventoryItems[index];
  if (item.type === 'weapon') {
    equipWeapon(scene, item);
    console.log(`Equipped ${item.name}`);
  } else if (item.type === 'shield') {
    equipShield(scene, item);
    console.log(`Equipped ${item.name}`);
  }
}

export function equipWeapon(scene, weaponItem) {
  if (scene.equippedWeapon) {
    // Potential swap logic here
  }
  scene.equippedWeapon = weaponItem;
  scene.hasMeleeWeapon = true;
  scene.meleeWeaponType = weaponItem.subtype;
  scene.meleeWeaponName = weaponItem.name;
  const uiScene = scene.scene.get(SCENES.UI);
  if (uiScene && uiScene.scene.isActive()) {
    uiScene.updateWeaponDisplay({ name: weaponItem.name, type: weaponItem.subtype });
  }
}

export function equipShield(scene, shieldItem) {
  if (scene.equippedShield) {
    // Potential swap logic here
  }
  scene.equippedShield = shieldItem;
  scene.hasShield = true;
  scene.shieldType = shieldItem.subtype;
  scene.shieldName = shieldItem.name;
  const uiScene = scene.scene.get(SCENES.UI);
  if (uiScene && uiScene.scene.isActive()) {
    uiScene.updateShieldDisplay({ name: shieldItem.name, type: shieldItem.subtype });
  }
}

export function toggleInventory(scene) {
  scene.inventoryOpen = !scene.inventoryOpen;
  if (scene.inventoryOpen) showInventory(scene);
  else hideInventory(scene);
}

export function showInventory(scene) {
  if (!scene.inventoryPanel) {
    const modal = createModal(scene, { coverHUD: false, depthBase: 400 });
    scene.inventoryBackdrop = modal.backdrop;
    scene.inventoryPanel = modal.panel;
    scene.inventoryTitle = addTitle(scene, modal, 'INVENTORY', { fontSize: '16px', color: '#ffffff' });
    scene.inventorySlots = [];
    scene.inventorySlotTexts = [];
    const cols = 4;
    const slotSize = { w: 35, h: 35 };
    const gutter = 8;
    const startX = modal.content.left + 10;
    const startY = modal.content.top + 28;
    for (let i = 0; i < scene.maxInventorySize; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = startX + col * (slotSize.w + gutter);
      const y = startY + row * (slotSize.h + gutter + 10);
      const slot = scene.add.rectangle(x, y, slotSize.w, slotSize.h, 0x666666);
      slot.setDepth(411);
      scene.inventorySlots.push(slot);
      const slotNumber = scene.add.text(x - slotSize.w/2 + 2, y - slotSize.h/2 + 2, `${i + 1}`, { fontSize: '10px', fill: '#ffffff' });
      slotNumber.setDepth(412);
      scene.inventorySlotTexts.push(slotNumber);
    }
  }
  updateInventoryDisplay(scene);
  if (scene.inventoryBackdrop) scene.inventoryBackdrop.setVisible(true);
  scene.inventoryPanel.setVisible(true);
  scene.inventoryTitle.setVisible(true);
  scene.inventorySlots.forEach(slot => slot.setVisible(true));
  scene.inventorySlotTexts.forEach(text => text.setVisible(true));
  UI.open('inventory');
}

export function hideInventory(scene) {
  if (!scene.inventoryPanel) return;
  if (scene.inventoryBackdrop) scene.inventoryBackdrop.setVisible(false);
  scene.inventoryPanel.setVisible(false);
  scene.inventoryTitle.setVisible(false);
  scene.inventorySlots.forEach(slot => slot.setVisible(false));
  scene.inventorySlotTexts.forEach(text => text.setVisible(false));
  if (scene.inventoryItemDisplays) {
    scene.inventoryItemDisplays.forEach(display => { if (display.sprite) display.sprite.setVisible(false); if (display.text) display.text.setVisible(false); });
  }
  if (scene.equipmentDisplays) {
    scene.equipmentDisplays.forEach(display => { if (display.sprite) display.sprite.setVisible(false); if (display.text) display.text.setVisible(false); });
  }
  UI.close('inventory');
}

export function updateInventoryDisplay(scene) {
  if (scene.inventoryItemDisplays) {
    scene.inventoryItemDisplays.forEach(display => { if (display.sprite) display.sprite.destroy(); if (display.text) display.text.destroy(); });
  }
  if (scene.equipmentDisplays) {
    scene.equipmentDisplays.forEach(display => { if (display.sprite) display.sprite.destroy(); if (display.text) display.text.destroy(); });
  }
  scene.inventoryItemDisplays = [];
  scene.equipmentDisplays = [];
  for (let i = 0; i < Math.min(scene.maxInventorySize, scene.inventoryItems.length); i++) {
    const item = scene.inventoryItems[i];
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = 80 + (col * 40);
    const y = 100 + (row * 45);
    const isEquipped = (scene.equippedWeapon && scene.equippedWeapon === item) || (scene.equippedShield && scene.equippedShield === item);
    if (isEquipped) scene.inventorySlots[i].setFillStyle(0x00FF00, 0.3);
    else scene.inventorySlots[i].setFillStyle(0x666666);
    let itemSprite;
    if (item.type === 'weapon') itemSprite = scene.add.rectangle(x, y, item.size.width / 2, item.size.height * 2, item.color);
    else if (item.type === 'shield') itemSprite = scene.add.rectangle(x, y, item.size.width, item.size.height, item.color);
    itemSprite.setDepth(12);
    const itemText = scene.add.text(x, y + 25, item.name, { fontSize: '8px', fill: isEquipped ? '#00FF00' : '#ffffff', align: 'center', wordWrap: { width: 35 } });
    itemText.setOrigin(0.5);
    itemText.setDepth(12);
    scene.inventoryItemDisplays.push({ sprite: itemSprite, text: itemText });
  }
}

export function updateEquipmentHUD(scene) {
  const uiScene = scene.scene.get(SCENES.UI);
  if (!uiScene || !uiScene.scene.isActive()) {
    console.log('UIScene not ready for equipment update');
    return;
  }
  console.log('Updating equipment HUD - Weapon:', scene.equippedWeapon?.name, 'Shield:', scene.equippedShield?.name);
  if (scene.equippedWeapon) uiScene.updateWeaponDisplay({ name: scene.equippedWeapon.name, type: scene.equippedWeapon.subtype });
  else uiScene.updateWeaponDisplay({ name: 'None', type: 'none' });
  if (scene.equippedShield) uiScene.updateShieldDisplay({ name: scene.equippedShield.name, type: scene.equippedShield.subtype });
  else uiScene.updateShieldDisplay({ name: 'None', type: 'none' });
}

export function equipDefaultWeapon(scene) {
  const defaultWeapon = { type: 'weapon', subtype: 'starter', name: 'Rusty Dagger', color: 0x666666, size: { width: 14, height: 3 }, swingDuration: 350 };
  addToInventory(scene, defaultWeapon);
  equipWeapon(scene, defaultWeapon);
  console.log('Equipped default starter weapon: Rusty Dagger');
}
