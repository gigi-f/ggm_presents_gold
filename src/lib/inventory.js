/*
 AI-INDEX
 - Tags: mechanics.inventory
 - See: docs/ai/index.json
*/
import { SCENES } from './constants';

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
    scene.inventoryPanel = scene.add.rectangle(160, 120, 300, 180, 0x333333, 0.8);
    scene.inventoryPanel.setDepth(10);
    scene.inventoryTitle = scene.add.text(160, 50, 'INVENTORY', { fontSize: '16px', fill: '#ffffff', align: 'center' });
    scene.inventoryTitle.setOrigin(0.5);
    scene.inventoryTitle.setDepth(11);
    scene.inventorySlots = [];
    scene.inventorySlotTexts = [];
    for (let i = 0; i < scene.maxInventorySize; i++) {
      const row = Math.floor(i / 4);
      const col = i % 4;
      const x = 80 + (col * 40);
      const y = 100 + (row * 45);
      const slot = scene.add.rectangle(x, y, 35, 35, 0x666666);
      slot.setDepth(11);
      scene.inventorySlots.push(slot);
      const slotNumber = scene.add.text(x - 15, y - 15, `${i + 1}`, { fontSize: '12px', fill: '#ffffff' });
      slotNumber.setDepth(12);
      scene.inventorySlotTexts.push(slotNumber);
    }
  }
  updateInventoryDisplay(scene);
  scene.inventoryPanel.setVisible(true);
  scene.inventoryTitle.setVisible(true);
  scene.inventorySlots.forEach(slot => slot.setVisible(true));
  scene.inventorySlotTexts.forEach(text => text.setVisible(true));
}

export function hideInventory(scene) {
  if (!scene.inventoryPanel) return;
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
