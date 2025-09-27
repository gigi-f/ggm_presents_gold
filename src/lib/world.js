/*
 AI-INDEX
 - Tags: mechanics.doors, mechanics.economy, mechanics.buildings
 - See: docs/ai/index.json
*/
import { MAP_IDS, DOOR_IDS } from './constants';
import { getCurrencySpec } from './economy';
import { createShopBuilding as genShop } from './buildings';
import * as Enemies from './enemies';

export function initializeGrid(scene) {
  scene.gridWidth = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  scene.gridHeight = Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  scene.occupiedCells = new Set();
  scene.gridVisible = false;
  scene.gridLines = null;
}

export function isInEdgeGap(scene, index, skipSet) {
  const r = scene.edgeGapRadius ?? 1;
  for (let i = -r; i <= r; i++) {
    if (skipSet.has(index + i)) return true;
  }
  return false;
}

export function isGridCellAvailable(scene, gridX, gridY) {
  if (gridX < 1 || gridX >= scene.gridWidth - 1 || gridY < 1 || gridY >= scene.gridHeight - 1) return false;
  const cellKey = `${gridX},${gridY}`;
  return !scene.occupiedCells.has(cellKey);
}

export function occupyGridCell(scene, gridX, gridY) {
  const cellKey = `${gridX},${gridY}`;
  scene.occupiedCells.add(cellKey);
}

export function gridToWorld(scene, gridX, gridY) {
  return { x: gridX * scene.gridCellSize + scene.gridCellSize / 2, y: gridY * scene.gridCellSize + scene.gridCellSize / 2 };
}

export function worldToGrid(scene, worldX, worldY) {
  return { gridX: Math.floor(worldX / scene.gridCellSize), gridY: Math.floor(worldY / scene.gridCellSize) };
}

export function createDoorContainer(scene, worldX, worldY, kind = 'entrance', meta = {}) {
  const container = scene.add.container(worldX, worldY);
  // Ensure door renders above buildings and wall collisions
  container.setDepth(100);
  container.isDoorContainer = true;
  container.kind = kind;

  const cs = scene.gridCellSize ?? 16;
  const doorRect = scene.add.rectangle(0, 0, cs + 8, cs * 2 + 4, 0x654321);
  scene.physics.add.existing(doorRect);
  doorRect.body.setImmovable(false);
  doorRect.setDepth(101);
  doorRect.isShopDoor = true;
  doorRect.ownerContainer = container;
  // Align door's bottom with the bottom of its grid cell (and the building bottom)
  doorRect.setOrigin(0.5, 1);
  doorRect.y = cs / 2;

  const handle = scene.add.circle(4, -8, 2, 0xFFD700);
  handle.setDepth(102);
  handle.isDoorHandle = true;

  container.add([doorRect, handle]);
  container.doorRect = doorRect;
  container.doorHandle = handle;
  return container;
}

export function placeObjectOnGrid(scene, gridX, gridY, objectType, addToGroup = null, extraData = {}) {
  if (!isGridCellAvailable(scene, gridX, gridY)) return null;
  const worldPos = gridToWorld(scene, gridX, gridY);
  let obj = null;
  switch (objectType) {
    case 'bush': {
      obj = scene.add.circle(worldPos.x, worldPos.y, 12, 0x228b22);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'weapon': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, extraData.width, extraData.height, extraData.color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.weaponType = extraData.weaponType;
      obj.weaponName = extraData.weaponName;
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'shield': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, extraData.width, extraData.height, extraData.color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.shieldType = extraData.shieldType;
      obj.shieldName = extraData.shieldName;
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'currency': {
      const type = extraData.type || 'copper';
      const spec = getCurrencySpec(type);
      if (!spec) return null;
      obj = scene.add.circle(worldPos.x, worldPos.y, spec.radius, spec.color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.currencyType = type;
      obj.currencyValue = spec.value;
      obj.setDepth(1);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'treeTrunkSmall': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 12, 32, 0x654321);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.setDepth(0);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'treeTrunkMedium': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 14, 32, 0x8B4513);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.setDepth(0);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'treeTrunkLarge': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 16, 32, 0x8B4513);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.setDepth(0);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'shopDoor': {
      obj = createDoorContainer(scene, worldPos.x, worldPos.y, extraData.kind || 'entrance', extraData);
      if (addToGroup && obj && obj.doorRect) addToGroup.add(obj.doorRect);
      if (scene.worldLayer && obj) scene.worldLayer.add(obj);
      break;
    }
    case 'buildingWall': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 16, 16, 0x8B4513);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.setDepth(0);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'shopSign': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 32, 16, 0x654321);
      obj.setDepth(1);
      const signText = scene.add.text(worldPos.x, worldPos.y, 'SHOP', { fontSize: '8px', fill: '#FFFFFF', align: 'center', fontStyle: 'bold' });
      signText.setOrigin(0.5, 0.5);
      signText.setDepth(2);
      if (scene.worldLayer) scene.worldLayer.add(signText);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
  }
  if (obj) occupyGridCell(scene, gridX, gridY);
  return obj;
}

export function createGridVisualization(scene) {
  if (scene.gridLines) scene.gridLines.destroy();
  const cs = scene.gridCellSize;
  scene.gridLines = scene.add.graphics();
  scene.gridLines.setDepth(10);
  scene.gridLines.setScrollFactor(0);
  scene.gridLines.setAlpha(0.3);
  for (let x = 0; x <= scene.gridWidth; x++) {
    const worldX = x * cs;
    scene.gridLines.lineStyle(1, 0x00FF00);
    scene.gridLines.beginPath();
    scene.gridLines.moveTo(worldX, 0);
    scene.gridLines.lineTo(worldX, scene.gridHeight * cs);
    scene.gridLines.strokePath();
  }
  for (let y = 0; y <= scene.gridHeight; y++) {
    const worldY = y * cs;
    scene.gridLines.lineStyle(1, 0x00FF00);
    scene.gridLines.beginPath();
    scene.gridLines.moveTo(0, worldY);
    scene.gridLines.lineTo(scene.gridWidth * cs, worldY);
    scene.gridLines.strokePath();
  }
  scene.occupiedCells.forEach(cellKey => {
    const [gridX, gridY] = cellKey.split(',').map(Number);
    const worldPos = gridToWorld(scene, gridX, gridY);
    scene.gridLines.fillStyle(0xFF0000, 0.2);
    scene.gridLines.fillRect(worldPos.x - cs / 2, worldPos.y - cs / 2, cs, cs);
  });
  scene.gridLines.setVisible(scene.gridVisible);
}

export function toggleGridVisibility(scene) {
  scene.gridVisible = !scene.gridVisible;
  if (scene.gridVisible) {
    createGridVisualization(scene);
    console.log('Grid visualization ON - Green lines show grid, red squares show occupied cells');
  } else {
    if (scene.gridLines) scene.gridLines.setVisible(false);
    console.log('Grid visualization OFF');
  }
}

export function createShopBuilding(scene, doorGridX, doorGridY) { return genShop(scene, doorGridX, doorGridY); }

export function createDoorsForMap(scene) {
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  for (const [doorId, doorData] of Object.entries(mapDoors)) {
    if (doorData.type === 'building_entrance' || doorData.type === 'building_exit') {
      const doorContainer = placeObjectOnGrid(scene, doorData.gridX, doorData.gridY, 'shopDoor', null, { kind: doorData.type });
      if (doorContainer) {
        doorContainer.doorId = doorId;
        scene.activeDoors[doorId] = doorContainer;
        const sensor = doorContainer.doorRect;
        if (doorData.type === 'building_entrance') {
          scene.physics.add.overlap(scene.player, sensor, scene.enterBuilding, () => !scene.transitionLock, scene);
          if (doorId === DOOR_IDS.SHOP_DOOR_01 && scene.currentMap === MAP_IDS.OVERWORLD_01) {
            // Seeded by map + door for deterministic variation
            createShopBuilding(scene, doorData.gridX, doorData.gridY, { seed: `${scene.currentMap}:${doorId}` });
            // After building is drawn, make sure the door renders above it
            if (scene.worldLayer && doorContainer) {
              try { scene.worldLayer.bringToTop(doorContainer); } catch (e) { /* noop if not supported */ }
            }
          }
        } else {
          scene.physics.add.overlap(scene.player, sensor, scene.exitBuilding, () => !scene.transitionLock, scene);
        }
      }
    } else if (
      doorData.type === 'edge_north' ||
      doorData.type === 'edge_south' ||
      doorData.type === 'edge_east' ||
      doorData.type === 'edge_west'
    ) {
      let gx = doorData.gridX, gy = doorData.gridY;
      if (scene.maps[scene.currentMap]?.type === 'overworld') {
        if (doorData.type === 'edge_north' && gy !== 0) { console.warn(`Door ${doorId} should be on north edge; clamping gy to 0 (was ${gy}).`); gy = 0; }
        if (doorData.type === 'edge_south' && gy !== maxGY) { console.warn(`Door ${doorId} should be on south edge; clamping gy to ${maxGY} (was ${gy}).`); gy = maxGY; }
        if (doorData.type === 'edge_west' && gx !== 0) { console.warn(`Door ${doorId} should be on west edge; clamping gx to 0 (was ${gx}).`); gx = 0; }
        if (doorData.type === 'edge_east' && gx !== maxGX) { console.warn(`Door ${doorId} should be on east edge; clamping gx to ${maxGX} (was ${gx}).`); gx = maxGX; }
      }
      let worldPos = gridToWorld(scene, gx, gy);
      const r = scene.edgeGapRadius ?? 1;
      const span = (2 * r + 1);
      let sensorW = 14, sensorH = 14, offX = 0, offY = 0;
      if (doorData.type === 'edge_east' || doorData.type === 'edge_west') {
        sensorW = scene.gridCellSize;
        sensorH = scene.gridCellSize * span;
        offX = (doorData.type === 'edge_west') ? scene.gridCellSize * 0.25 : -scene.gridCellSize * 0.25;
      } else {
        sensorW = scene.gridCellSize * span;
        sensorH = scene.gridCellSize;
        offY = (doorData.type === 'edge_north') ? scene.gridCellSize * 0.25 : -scene.gridCellSize * 0.25;
      }
      const sensor = scene.add.rectangle(worldPos.x + offX, worldPos.y + offY, sensorW, sensorH, 0x000000, 0);
      scene.physics.add.existing(sensor);
      sensor.body.setImmovable(false);
      sensor.isEdgeExit = true;
      sensor.doorId = doorId;
      if (scene.worldLayer) scene.worldLayer.add(sensor);
      scene.activeDoors[doorId] = sensor;
      scene.physics.add.overlap(scene.player, sensor, scene.handleEdgeExit, () => !scene.transitionLock, scene);
    }
  }
}

export function createMapObjects(scene, options = {}) {
  scene.occupiedCells.clear();
  if (!options.preserveExistingWorld && scene.worldLayer) scene.worldLayer.destroy(true);
  if (!options.buildIntoExistingWorldLayer || !scene.worldLayer) scene.worldLayer = scene.add.container(0, 0);
  scene.activeDoors = {};
  if (!scene.boundaryRocks) scene.boundaryRocks = scene.add.group();
  if (!scene.mapBushes) scene.mapBushes = scene.add.group();
  if (!scene.treeTrunks) scene.treeTrunks = scene.add.group();
  if (!scene.stumps) scene.stumps = scene.add.group();
  if (!scene.buildingWalls) scene.buildingWalls = scene.add.group();
  if (!scene.enemiesGroup) scene.enemiesGroup = scene.add.group();
  // Clear previous building wall colliders to avoid stale collision blocking
  if (scene.buildingWalls) {
    scene.buildingWalls.clear(true, true);
  }
  // Clear existing enemies on rebuild unless preserved (for persistence across transitions/boss rooms)
  if (scene.enemiesGroup && !options.preserveEnemies) {
    scene.enemiesGroup.clear(true, true);
  }

  const currentMapData = scene.maps[scene.currentMap];
  const isShop = currentMapData.type === 'shop';
  const cs = scene.gridCellSize;
  const W = scene.worldPixelWidth;
  const H = scene.worldPixelHeight;

  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const skipTopXs = new Set();
  const skipBottomXs = new Set();
  const skipLeftYs = new Set();
  const skipRightYs = new Set();
  for (const [, d] of Object.entries(mapDoors)) {
    if (d.type === 'edge_north') skipTopXs.add(d.gridX);
    else if (d.type === 'edge_south') skipBottomXs.add(d.gridX);
    else if (d.type === 'edge_west') skipLeftYs.add(d.gridY);
    else if (d.type === 'edge_east') skipRightYs.add(d.gridY);
    // Remove automatic wall gap for building_exit doors - let the door sprite handle access
  }

  for (let x = 0; x < W; x += cs) {
    const gx = Math.floor(x / cs);
    if (isInEdgeGap(scene, gx, skipTopXs)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1);
      rock1.body.setImmovable(true);
      scene.boundaryRocks.add(rock1);
      if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(x + cs/2, cs + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2);
      rock2.body.setImmovable(true);
      scene.boundaryRocks.add(rock2);
      if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock);
      rock.body.setImmovable(true);
      scene.boundaryRocks.add(rock);
      if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let x = 0; x < W; x += cs) {
    const gx = Math.floor(x / cs);
    if (isInEdgeGap(scene, gx, skipBottomXs)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(x + cs/2, H - (cs + cs/2), cs, cs, 0x666666);
      scene.physics.add.existing(rock1);
      rock1.body.setImmovable(true);
      scene.boundaryRocks.add(rock1);
      if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2);
      rock2.body.setImmovable(true);
      scene.boundaryRocks.add(rock2);
      if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock);
      rock.body.setImmovable(true);
      scene.boundaryRocks.add(rock);
      if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let y = cs; y < H - cs; y += cs) {
    const gy = Math.floor((y - cs/2) / cs);
    if (isInEdgeGap(scene, gy, skipLeftYs)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1);
      rock1.body.setImmovable(true);
      scene.boundaryRocks.add(rock1);
      if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(cs + cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2);
      rock2.body.setImmovable(true);
      scene.boundaryRocks.add(rock2);
      if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock);
      rock.body.setImmovable(true);
      scene.boundaryRocks.add(rock);
      if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let y = cs; y < H - cs; y += cs) {
    const gy = Math.floor((y - cs/2) / cs);
    if (isInEdgeGap(scene, gy, skipRightYs)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(W - (cs + cs/2), y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1);
      rock1.body.setImmovable(true);
      scene.boundaryRocks.add(rock1);
      if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2);
      rock2.body.setImmovable(true);
      scene.boundaryRocks.add(rock2);
      if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock);
      rock.body.setImmovable(true);
      scene.boundaryRocks.add(rock);
      if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  if (scene.currentMap === MAP_IDS.OVERWORLD_01) {
    scene.treeTrunks.clear();
    scene.stumps.clear();
    placeObjectOnGrid(scene, 9, 5, 'bush', scene.mapBushes);
    // Items moved to shop - overworld is now clear of weapons/shields
    
    // Add currency ingots (scalable via IDs)
    const spawnCurrency = (id, gx, gy, type) => {
      if (scene.collectedCurrency && scene.collectedCurrency.has(id)) return;
      const obj = placeObjectOnGrid(scene, gx, gy, 'currency', null, { type });
      if (obj) obj.currencyId = id;
      return obj;
    };
    scene.copperIngot1 = spawnCurrency('overworld1:copper1', 10, 5, 'copper');
    scene.silverIngot1 = spawnCurrency('overworld1:silver1', 11, 5, 'silver');
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_02) {
    scene.stumps.clear();
    placeObjectOnGrid(scene, 6, 7, 'bush', scene.mapBushes);
    placeObjectOnGrid(scene, 13, 11, 'bush', scene.mapBushes);
    placeObjectOnGrid(scene, 10, 3, 'treeTrunkLarge', scene.treeTrunks);
    placeObjectOnGrid(scene, 5, 12, 'treeTrunkSmall', scene.treeTrunks);
    placeObjectOnGrid(scene, 16, 8, 'treeTrunkMedium', scene.treeTrunks);
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_00) {
    scene.treeTrunks.clear();
    scene.stumps.clear();
    // Sparse props to differentiate visually
    placeObjectOnGrid(scene, 6, 6, 'bush', scene.mapBushes);
    placeObjectOnGrid(scene, 12, 8, 'treeTrunkSmall', scene.treeTrunks);
    placeObjectOnGrid(scene, 16, 6, 'bush', scene.mapBushes);
    // Place a bat perched on a tree just north of the trunk (sitting in the canopy)
    try {
      Enemies.spawnBatAtGrid(scene, 12, 7, { aggroRadius: 64, deaggroRadius: 120, speed: 90, leash: 160, damage: 10, persistentAcrossMaps: false });
    } catch (e) { console.warn('Failed to spawn bat:', e); }
  } else if (scene.currentMap === MAP_IDS.SHOP_01) {
    scene.treeTrunks.clear();
    scene.stumps.clear();
    // Shop is now clear of obstacles - place all items here instead
    // Create a counter to block access to items behind it
    if (!scene.shopCounter) {
      const left = gridToWorld(scene, 2, 6);
      const right = gridToWorld(scene, Math.floor(scene.worldPixelWidth / scene.gridCellSize) - 2, 6);
      const width = right.x - left.x;
      const counter = scene.add.rectangle(left.x + width / 2, left.y, width, 8, 0x5a3b2e);
      scene.physics.add.existing(counter);
      counter.body.setImmovable(true);
      counter.setDepth(1);
      scene.shopCounter = counter;
      if (scene.worldLayer) scene.worldLayer.add(counter);
    }
    // Place a shopkeeper NPC near the back counter
    if (!scene.shopkeeper) {
      const pos = gridToWorld(scene, 10, 6);
      scene.shopkeeper = scene.add.rectangle(pos.x, pos.y, 12, 18, 0xAA7733);
      scene.shopkeeper.setDepth(1);
      scene.physics.add.existing(scene.shopkeeper);
      scene.shopkeeper.body.setImmovable(true);
      if (scene.worldLayer) scene.worldLayer.add(scene.shopkeeper);
      // Add a simple name tag
      const label = scene.add.text(pos.x, pos.y - 14, 'Shopkeep', { fontSize: '7px', color: '#fff' });
      label.setOrigin(0.5, 1);
      label.setDepth(2);
      if (scene.worldLayer) scene.worldLayer.add(label);
      scene.shopkeeper.label = label;
    }
    if (!scene.collectedItems.meleeWeapon1) {
      const obj = placeObjectOnGrid(scene, 4, 4, 'weapon', null, { width: 12, height: 4, color: 0x888888, weaponType: 'basic', weaponName: 'Iron Pickaxe' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'weapon'; obj.itemSubtype = obj.weaponType; obj.itemName = obj.weaponName; }
      scene.meleeWeapon1 = obj;
    }
    if (!scene.collectedItems.meleeWeapon2) {
      const obj = placeObjectOnGrid(scene, 6, 4, 'weapon', null, { width: 14, height: 4, color: 0xFFD700, weaponType: 'strong', weaponName: 'Golden Pickaxe' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'weapon'; obj.itemSubtype = obj.weaponType; obj.itemName = obj.weaponName; }
      scene.meleeWeapon2 = obj;
    }
    if (!scene.collectedItems.meleeWeapon3) {
      const obj = placeObjectOnGrid(scene, 8, 4, 'weapon', null, { width: 10, height: 4, color: 0x00FFFF, weaponType: 'fast', weaponName: 'Crystal Pickaxe' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'weapon'; obj.itemSubtype = obj.weaponType; obj.itemName = obj.weaponName; }
      scene.meleeWeapon3 = obj;
    }
    if (!scene.collectedItems.shield1) {
      const obj = placeObjectOnGrid(scene, 12, 4, 'shield', null, { width: 10, height: 14, color: 0x654321, shieldType: 'basic', shieldName: 'Wooden Shield' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'shield'; obj.itemSubtype = obj.shieldType; obj.itemName = obj.shieldName; }
      scene.shield1 = obj;
    }
    if (!scene.collectedItems.shield2) {
      const obj = placeObjectOnGrid(scene, 14, 4, 'shield', null, { width: 12, height: 16, color: 0xC0C0C0, shieldType: 'strong', shieldName: 'Steel Shield' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'shield'; obj.itemSubtype = obj.shieldType; obj.itemName = obj.shieldName; }
      scene.shield2 = obj;
    }
    if (!scene.collectedItems.shield3) {
      const obj = placeObjectOnGrid(scene, 16, 4, 'shield', null, { width: 8, height: 12, color: 0x4169E1, shieldType: 'light', shieldName: 'Magic Shield' });
      if (obj) { obj.isShopItem = true; obj.itemType = 'shield'; obj.itemSubtype = obj.shieldType; obj.itemName = obj.shieldName; }
      scene.shield3 = obj;
    }
  }

  createDoorsForMap(scene);
  scene.physics.add.collider(scene.player, scene.boundaryRocks);
  scene.physics.add.collider(scene.player, scene.mapBushes);
  scene.physics.add.collider(scene.player, scene.treeTrunks);
  scene.physics.add.collider(scene.player, scene.buildingWalls);
  if (scene.shopCounter) scene.physics.add.collider(scene.player, scene.shopCounter);

  // Item overlaps (disabled in shop; purchases happen via dialog)
  if (scene.currentMap !== MAP_IDS.SHOP_01) {
    if (scene.meleeWeapon1) scene.physics.add.overlap(scene.player, scene.meleeWeapon1, scene.pickupMeleeWeapon, null, scene);
    if (scene.meleeWeapon2) scene.physics.add.overlap(scene.player, scene.meleeWeapon2, scene.pickupMeleeWeapon, null, scene);
    if (scene.meleeWeapon3) scene.physics.add.overlap(scene.player, scene.meleeWeapon3, scene.pickupMeleeWeapon, null, scene);
    if (scene.shield1) scene.physics.add.overlap(scene.player, scene.shield1, scene.pickupShield, null, scene);
    if (scene.shield2) scene.physics.add.overlap(scene.player, scene.shield2, scene.pickupShield, null, scene);
    if (scene.shield3) scene.physics.add.overlap(scene.player, scene.shield3, scene.pickupShield, null, scene);
  }
  if (scene.copperIngot1) scene.physics.add.overlap(scene.player, scene.copperIngot1, scene.pickupCurrency, null, scene);
  if (scene.silverIngot1) scene.physics.add.overlap(scene.player, scene.silverIngot1, scene.pickupCurrency, null, scene);

  if (scene.gridVisible) createGridVisualization(scene);
}
