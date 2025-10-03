import { rngFor, randInt } from './rng';
/*
 AI-INDEX
 - Tags: mechanics.doors, mechanics.economy, mechanics.buildings
 - See: docs/ai/index.json
*/
import { MAP_IDS, DOOR_IDS } from './constants';
import { getCurrencySpec, getShieldDisplaySize, getWeaponDisplayLength } from './economy';
import { createShopkeeperSprite } from './npcSprites';
import { generateBiomeContent, getBiomeForMap } from './biomes';
import { generateMazeWalls } from './maze';
import { createShopBuilding as genShop } from './buildings';

export function initializeGrid(scene: any) {
  scene.gridWidth = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  scene.gridHeight = Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  scene.occupiedCells = new Set<string>();
  scene.gridVisible = false;
  scene.gridLines = null;
  scene.terrainZones = scene.add ? scene.add.group() : null;
}

export function isInEdgeGap(_scene: any, index: number, skipSet: Set<number>) { return skipSet?.has(index) || false; }

export function isGridCellAvailable(scene: any, gridX: number, gridY: number) {
  if (gridX < 1 || gridX >= scene.gridWidth - 1 || gridY < 1 || gridY >= scene.gridHeight - 1) return false;
  const cellKey = `${gridX},${gridY}`;
  return !scene.occupiedCells.has(cellKey);
}

export function occupyGridCell(scene: any, gridX: number, gridY: number) {
  const cellKey = `${gridX},${gridY}`;
  scene.occupiedCells.add(cellKey);
}

export function gridToWorld(scene: any, gridX: number, gridY: number) {
  return { x: gridX * scene.gridCellSize + scene.gridCellSize / 2, y: gridY * scene.gridCellSize + scene.gridCellSize / 2 };
}

export function worldToGrid(scene: any, worldX: number, worldY: number) {
  return { gridX: Math.floor(worldX / scene.gridCellSize), gridY: Math.floor(worldY / scene.gridCellSize) };
}

export function quantizeWorldPosition(scene: any, worldX: number, worldY: number, opts: any = {}) {
  const cs = scene.gridCellSize || 16;
  const W = scene.gridWidth ?? Math.floor(scene.worldPixelWidth / cs);
  const H = scene.gridHeight ?? Math.floor(scene.worldPixelHeight / cs);
  const interior = (opts.interior !== undefined) ? !!opts.interior : true;
  const mode = opts.mode || 'nearest';
  const clampMinGX = interior ? 1 : 0;
  const clampMinGY = interior ? 1 : 0;
  const clampMaxGX = interior ? (W - 2) : (W - 1);
  const clampMaxGY = interior ? (H - 2) : (H - 1);

  const roundIdx = (value: number) => {
    if (mode === 'floor') return Math.floor(value);
    if (mode === 'ceil') return Math.ceil(value);
    return Math.round(value);
  };

  let gx = roundIdx(worldX / cs - 0.5);
  let gy = roundIdx(worldY / cs - 0.5);
  gx = Math.max(clampMinGX, Math.min(clampMaxGX, gx));
  gy = Math.max(clampMinGY, Math.min(clampMaxGY, gy));
  const center = gridToWorld(scene, gx, gy);
  const x = center.x + (opts.offsetX || 0);
  const y = center.y + (opts.offsetY || 0);
  if (opts.markOccupied) occupyGridCell(scene, gx, gy);
  return { x, y, gridX: gx, gridY: gy };
}

export function quantizeObjectToGrid(scene: any, obj: any, opts: any = {}) {
  if (!obj) return null;
  const q = quantizeWorldPosition(scene, obj.x, obj.y, opts);
  obj.x = q.x; obj.y = q.y;
  const snapBody = opts.snapBody !== undefined ? !!opts.snapBody : true;
  try {
    if (snapBody && obj.body && obj.body.type === (scene.physics?.world?.ARCADE || 0)) {
      if (typeof obj.body.reset === 'function') obj.body.reset(q.x, q.y);
      else { obj.body.x = q.x - obj.body.halfWidth; obj.body.y = q.y - obj.body.halfHeight; }
    }
  } catch {}
  return q;
}

export function findNearestFreeWorldPosition(scene: any, desiredX: number, desiredY: number, opts: any = {}) {
  const maxRadius = Number.isFinite(opts.maxRadius) ? Math.max(1, opts.maxRadius) : 6;
  const { gridX: sx, gridY: sy } = worldToGrid(scene, desiredX, desiredY);
  const W = scene.gridWidth ?? Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  const H = scene.gridHeight ?? Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  const inInterior = (gx: number, gy: number) => gx >= 1 && gx <= W - 2 && gy >= 1 && gy <= H - 2;
  const free = (gx: number, gy: number) => inInterior(gx, gy) && isGridCellAvailable(scene, gx, gy);
  if (free(sx, sy)) return gridToWorld(scene, sx, sy);
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const gx = sx + dx, gy = sy + dy;
        if (free(gx, gy)) return gridToWorld(scene, gx, gy);
      }
    }
  }
  const fallbackGX = Math.max(1, Math.min(W - 2, Math.floor(W / 2)));
  const fallbackGY = Math.max(1, Math.min(H - 2, Math.floor(H / 2)));
  return gridToWorld(scene, fallbackGX, fallbackGY);
}

export function createDoorContainer(scene: any, worldX: number, worldY: number, kind: string = 'entrance', _meta: any = {}) {
  const container = scene.add.container(worldX, worldY);
  container.setDepth(100);
  container.isDoorContainer = true;
  container.kind = kind;

  const cs = scene.gridCellSize ?? 16;
  const doorRect = scene.add.rectangle(0, 0, cs + 8, cs * 2 + 8, 0x654321);
  scene.physics.add.existing(doorRect);
  doorRect.body.setImmovable(false);
  doorRect.setDepth(101);
  doorRect.isShopDoor = true;
  doorRect.ownerContainer = container;
  doorRect.setOrigin(0.5, 1);
  doorRect.y = cs / 2;

  const handle = scene.add.circle(4, -8, 2, 0xFFD700);
  handle.setDepth(102);
  handle.isDoorHandle = true;

  container.add([doorRect, handle]);
  (container as any).doorRect = doorRect;
  (container as any).doorHandle = handle;
  return container;
}

export function placeObjectOnGrid(scene: any, gridX: number, gridY: number, objectType: string, addToGroup: any = null, extraData: any = {}) {
  if (!isGridCellAvailable(scene, gridX, gridY)) return null;
  const worldPos = gridToWorld(scene, gridX, gridY);
  let obj: any = null;
  switch (objectType) {
    case 'weapon': {
      const w = Math.round(extraData.width || 16);
      const h = Math.round(extraData.height || 4);
      obj = scene.add.rectangle(worldPos.x, worldPos.y, w, h, extraData.color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      // Ensure physics body matches the visual rectangle size and is properly offset
      try {
        if (obj.body && typeof obj.body.setSize === 'function') {
          obj.body.setSize(w, h);
          if (typeof obj.body.setOffset === 'function' && obj.displayWidth != null && obj.displayHeight != null) {
            const offX = (obj.displayWidth - w) / 2;
            const offY = (obj.displayHeight - h) / 2;
            try { obj.body.setOffset(offX, offY); } catch {}
          }
        }
      } catch {}
      obj.weaponType = extraData.weaponType;
      obj.weaponName = extraData.weaponName;
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'goldIngot': {
      const w = extraData.width || 10;
      const h = extraData.height || 6;
      const color = extraData.color || 0xffd700;
      obj = scene.add.rectangle(worldPos.x, worldPos.y, w, h, color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.isGoldIngot = true;
      obj.goldId = extraData.goldId || null;
      obj.setDepth(1);
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
    case 'consumable': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, extraData.width || 8, extraData.height || 12, extraData.color || 0xFF6666);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.consumableType = extraData.consumableType;
      obj.consumableName = extraData.consumableName;
      obj.healAmount = extraData.healAmount || 0;
      obj.staminaAmount = extraData.staminaAmount || 0;
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
      if (addToGroup && obj && (obj as any).doorRect) addToGroup.add((obj as any).doorRect);
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
    case 'cactus': {
      const h = (extraData?.height) || 14;
      obj = scene.add.rectangle(worldPos.x, worldPos.y, 8, h, 0x2e8b57);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.setDepth(0);
      if (addToGroup) addToGroup.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
  }
  if (obj) occupyGridCell(scene, gridX, gridY);
  return obj;
}

export function createGridVisualization(scene: any) {
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
  scene.occupiedCells.forEach((cellKey: string) => {
    const [gridX, gridY] = cellKey.split(',').map(Number);
    const worldPos = gridToWorld(scene, gridX, gridY);
    scene.gridLines.fillStyle(0xFF0000, 0.2);
    scene.gridLines.fillRect(worldPos.x - cs / 2, worldPos.y - cs / 2, cs, cs);
  });
  scene.gridLines.setVisible(scene.gridVisible);
}

export function toggleGridVisibility(scene: any) {
  scene.gridVisible = !scene.gridVisible;
  if (scene.gridVisible) {
    createGridVisualization(scene);
    console.log('Grid visualization ON - Green lines show grid, red squares show occupied cells');
  } else {
    if (scene.gridLines) scene.gridLines.setVisible(false);
    console.log('Grid visualization OFF');
  }
}

export function createShopBuilding(scene: any, doorGridX: number, doorGridY: number) { return genShop(scene, doorGridX, doorGridY); }

export function createDoorsForMap(scene: any) {
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  for (const [doorId, doorData] of Object.entries<any>(mapDoors)) {
    if (doorData.type === 'building_entrance' || doorData.type === 'building_exit') {
      const doorContainer = placeObjectOnGrid(scene, doorData.gridX, doorData.gridY, 'shopDoor', null, { kind: doorData.type });
      if (doorContainer) {
        (doorContainer as any).doorId = doorId;
        scene.activeDoors[doorId] = doorContainer;
        const sensor = (doorContainer as any).doorRect;
        if (doorData.type === 'building_entrance') {
          scene.physics.add.overlap(scene.player, sensor, scene.enterBuilding, () => !scene.transitionLock, scene);
          // If this is the configured shop door for this world, create the shop building
          // Use scene.shopHostId (set by MainScene) so the building appears where the shop was placed
          const shopHost = (scene && scene.shopHostId) ? scene.shopHostId : MAP_IDS.OVERWORLD_01;
          if (doorId === DOOR_IDS.SHOP_DOOR_01 && scene.currentMap === shopHost) {
            createShopBuilding(scene, doorData.gridX, doorData.gridY);
            if (scene.worldLayer && doorContainer) {
              try { scene.worldLayer.bringToTop(doorContainer); } catch {}
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
        if (doorData.type === 'edge_north' && gy !== 0) { gy = 0; }
        if (doorData.type === 'edge_south' && gy !== maxGY) { gy = maxGY; }
        if (doorData.type === 'edge_west' && gx !== 0) { gx = 0; }
        if (doorData.type === 'edge_east' && gx !== maxGX) { gx = maxGX; }
      }
      const worldPos = gridToWorld(scene, gx, gy);
      const half = getEffectiveEdgeHalfWidth(scene, scene.currentMap, doorId, { ...doorData, gridX: gx, gridY: gy });
      const span = (2 * half + 1);
      let sensorW = scene.gridCellSize, sensorH = scene.gridCellSize;
      let sx = worldPos.x, sy = worldPos.y;
      if (doorData.type === 'edge_east' || doorData.type === 'edge_west') {
        sensorW = scene.gridCellSize;
        sensorH = scene.gridCellSize * span;
      } else {
        sensorW = scene.gridCellSize * span;
        sensorH = scene.gridCellSize;
      }
      const sensor = scene.add.rectangle(sx, sy, sensorW, sensorH, 0x000000, 0);
      scene.physics.add.existing(sensor);
      sensor.body.setImmovable(false);
      (sensor as any).isEdgeExit = true;
      (sensor as any).doorId = doorId;
      if (scene.worldLayer) scene.worldLayer.add(sensor);
      scene.activeDoors[doorId] = sensor;
      scene.physics.add.overlap(scene.player, sensor, scene.handleEdgeExit, () => !scene.transitionLock, scene);
    }
  }
}

function computeEdgeOpenRanges(scene: any) {
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const openTop = new Set<number>();
  const openBottom = new Set<number>();
  const openLeft = new Set<number>();
  const openRight = new Set<number>();
  const maxGX = (scene.gridWidth ?? Math.floor(scene.worldPixelWidth / scene.gridCellSize)) - 1;
  const maxGY = (scene.gridHeight ?? Math.floor(scene.worldPixelHeight / scene.gridCellSize)) - 1;
  for (const [, d] of Object.entries<any>(mapDoors)) {
    const half = getEffectiveEdgeHalfWidth(scene, scene.currentMap, (d as any).doorId || (d as any).id || Object.keys(mapDoors).find(k => (mapDoors as any)[k] === d), d);
    if (d.type === 'edge_north') {
      for (let i = Math.max(0, d.gridX - half); i <= Math.min(maxGX, d.gridX + half); i++) openTop.add(i);
    } else if (d.type === 'edge_south') {
      for (let i = Math.max(0, d.gridX - half); i <= Math.min(maxGX, d.gridX + half); i++) openBottom.add(i);
    } else if (d.type === 'edge_west') {
      for (let j = Math.max(0, d.gridY - half); j <= Math.min(maxGY, d.gridY + half); j++) openLeft.add(j);
    } else if (d.type === 'edge_east') {
      for (let j = Math.max(0, d.gridY - half); j <= Math.min(maxGY, d.gridY + half); j++) openRight.add(j);
    }
  }
  return { top: openTop, bottom: openBottom, left: openLeft, right: openRight };
}

function getEffectiveEdgeHalfWidth(scene: any, mapId: any, doorId: any, doorData: any) {
  const baseFrom = (d: any, mapType: string) => {
    const raw = Number.isFinite(d?.entranceHalfWidth) ? Math.floor(d.entranceHalfWidth) : Math.floor(scene.edgeGapRadius ?? 0);
    const half = Math.max(0, raw);
    const minHalf = (mapType === 'overworld') ? 1 : 0;
    return Math.max(half, minHalf);
  };

  const mapType = scene.maps?.[mapId]?.type;
  const thisHalf = baseFrom(doorData, mapType);

  let linkedHalf = 0;
  const link = scene.maps?.[mapId]?.doors?.[doorId];
  if (link && link.targetMap && link.targetDoor) {
    const targetDoor = scene.doorRegistry?.[link.targetMap]?.[link.targetDoor];
    if (targetDoor) {
      const targetMapType = scene.maps?.[link.targetMap]?.type;
      linkedHalf = baseFrom(targetDoor, targetMapType);
    }
  }
  return Math.max(thisHalf, linkedHalf);
}

export function createMapObjects(scene: any, options: any = {}) {
  scene.occupiedCells.clear();
  // World base layer
  if (!options.preserveExistingWorld && scene.worldLayer) scene.worldLayer.destroy(true);
  if (!options.buildIntoExistingWorldLayer || !scene.worldLayer) scene.worldLayer = scene.add.container(0, 0);
  // World overlay layer (above player/enemies)
  if (!options.preserveExistingWorld && scene.worldOverlayLayer) scene.worldOverlayLayer.destroy(true);
  if (!options.buildIntoExistingWorldOverlayLayer || !scene.worldOverlayLayer) scene.worldOverlayLayer = scene.add.container(0, 0);
  try { scene.worldOverlayLayer.setDepth(5); } catch {}
  scene.activeDoors = {};
  if (!scene.boundaryRocks) scene.boundaryRocks = scene.add.group();
  if (!scene.treeTrunks) scene.treeTrunks = scene.add.group();
  if (!scene.buildingWalls) scene.buildingWalls = scene.add.group();
  if (!scene.enemiesGroup) scene.enemiesGroup = scene.add.group();
  if (!scene.terrainZones) scene.terrainZones = scene.add.group();
  if (!scene.tallGrassSensors) scene.tallGrassSensors = scene.add.group();
  if (scene.terrainZones) scene.terrainZones.clear(true, true);
  if (!options.preserveExistingWorld && scene.tallGrassSensors) scene.tallGrassSensors.clear(true, true);
  if (scene.buildingWalls) { scene.buildingWalls.clear(true, true); }
  if (scene.enemiesGroup && !options.preserveEnemies) { scene.enemiesGroup.clear(true, true); }
  if (!options.preserveExistingWorld) {
    if (scene.shopkeeper) { try { if (scene.shopkeeper.label) scene.shopkeeper.label.destroy(); } catch {} try { scene.shopkeeper.destroy(); } catch {} scene.shopkeeper = null; }
    if (scene._shopkeeperGunSprite) { try { scene._shopkeeperGunSprite.destroy(); } catch {} scene._shopkeeperGunSprite = null; }
    if (scene.shopCounter) { try { scene.shopCounter.destroy(); } catch {} scene.shopCounter = null; }
  }

  const currentMapData = scene.maps[scene.currentMap];
  const isShop = currentMapData.type === 'shop';
  const cs = scene.gridCellSize;
  const W = scene.worldPixelWidth;
  const H = scene.worldPixelHeight;

  const open = computeEdgeOpenRanges(scene);

  for (let x = 0; x < W; x += cs) {
    const gx = Math.floor(x / cs);
    if ((open.top as Set<number>).has(gx)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1); rock1.body.setImmovable(true); scene.boundaryRocks.add(rock1); if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(x + cs/2, cs + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2); rock2.body.setImmovable(true); scene.boundaryRocks.add(rock2); if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock); rock.body.setImmovable(true); scene.boundaryRocks.add(rock); if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let x = 0; x < W; x += cs) {
    const gx = Math.floor(x / cs);
    if ((open.bottom as Set<number>).has(gx)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(x + cs/2, H - (cs + cs/2), cs, cs, 0x666666);
      scene.physics.add.existing(rock1); rock1.body.setImmovable(true); scene.boundaryRocks.add(rock1); if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2); rock2.body.setImmovable(true); scene.boundaryRocks.add(rock2); if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock); rock.body.setImmovable(true); scene.boundaryRocks.add(rock); if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let y = cs; y < H - cs; y += cs) {
    const gy = Math.floor((y - cs/2) / cs);
    if ((open.left as Set<number>).has(gy)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1); rock1.body.setImmovable(true); scene.boundaryRocks.add(rock1); if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(cs + cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2); rock2.body.setImmovable(true); scene.boundaryRocks.add(rock2); if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock); rock.body.setImmovable(true); scene.boundaryRocks.add(rock); if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  for (let y = cs; y < H - cs; y += cs) {
    const gy = Math.floor((y - cs/2) / cs);
    if ((open.right as Set<number>).has(gy)) continue;
    if (isShop) {
      const rock1 = scene.add.rectangle(W - (cs + cs/2), y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock1); rock1.body.setImmovable(true); scene.boundaryRocks.add(rock1); if (scene.worldLayer) scene.worldLayer.add(rock1);
      const rock2 = scene.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock2); rock2.body.setImmovable(true); scene.boundaryRocks.add(rock2); if (scene.worldLayer) scene.worldLayer.add(rock2);
    } else {
      const rock = scene.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
      scene.physics.add.existing(rock); rock.body.setImmovable(true); scene.boundaryRocks.add(rock); if (scene.worldLayer) scene.worldLayer.add(rock);
    }
  }

  // Place starter items on the designated starting map (center of generated overworld)
  if (scene.currentMap === (scene.startMapId || null)) {
    scene.treeTrunks.clear();
    const spawnCurrency = (id: string, gx: number, gy: number, type: string) => {
      if (scene.collectedCurrency && scene.collectedCurrency.has(id)) return;
      const obj = placeObjectOnGrid(scene, gx, gy, 'currency', null, { type });
      if (obj) (obj as any).currencyId = id;
      return obj;
    };
    scene.copperIngot1 = spawnCurrency('overworld1:copper1', 10, 5, 'copper');
    scene.silverIngot1 = spawnCurrency('overworld1:silver1', 11, 5, 'silver');
    const spawnGold = (id: string, gx: number, gy: number) => {
      if (scene.collectedGoldIds && scene.collectedGoldIds.has(id)) return null;
      const obj = placeObjectOnGrid(scene, gx, gy, 'goldIngot', null, { goldId: id, width: 12, height: 6, color: 0xffd700 });
      if (obj) (obj as any).goldId = id;
      return obj;
    };
    // Spawn any gold placements that belong to this map
    if (Array.isArray((scene as any).worldGoldPlacements)) {
      let idx = 1;
      for (const p of (scene as any).worldGoldPlacements) {
        if (p.mapId === scene.currentMap) {
          const g = spawnGold(p.goldId, p.gx, p.gy);
          if (g) (scene as any)[`goldIngot${idx}`] = g;
          idx++;
        }
      }
    }
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_02) {
    // desert placeholder
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_00) {
    scene.treeTrunks.clear();
  } else if (scene.currentMap === MAP_IDS.SHOP_01) {
    scene.treeTrunks.clear();
    const left = gridToWorld(scene, 2, 6);
    const right = gridToWorld(scene, Math.floor(scene.worldPixelWidth / scene.gridCellSize) - 2, 6);
    const width = right.x - left.x;
    const counter = scene.add.rectangle(left.x + width / 2, left.y, width, 8, 0x5a3b2e);
    scene.physics.add.existing(counter); counter.body.setImmovable(true); counter.setDepth(1);
    scene.shopCounter = counter; if (scene.worldLayer) scene.worldLayer.add(counter);
    const pos = gridToWorld(scene, 10, 6);
    const seed = `${scene.currentMap}:keeper:main`;
    scene.shopkeeper = createShopkeeperSprite(scene, pos.x, pos.y, { seed });
    if (scene.worldLayer) scene.worldLayer.add(scene.shopkeeper);
    const label = scene.add.text(pos.x, pos.y - (scene.shopkeeper.npcConfig?.heightPx ?? 18) - 2, 'Shopkeep', { fontSize: '7px', color: '#fff' });
    label.setOrigin(0.5, 1); label.setDepth(2);
    if (scene.worldLayer) scene.worldLayer.add(label);
    scene.shopkeeper.label = label;
    if (!scene.collectedItems.meleeWeapon1) {
      try {
        const ws = getWeaponDisplayLength('basic');
        const obj = placeObjectOnGrid(scene, 4, 4, 'weapon', null, { width: ws.width, height: ws.height, color: 0x888888, weaponType: 'basic', weaponName: 'Iron Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon1 = obj;
      } catch (e) {
        const obj = placeObjectOnGrid(scene, 4, 4, 'weapon', null, { width: 12, height: 4, color: 0x888888, weaponType: 'basic', weaponName: 'Iron Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon1 = obj;
      }
    }
    if (!scene.collectedItems.meleeWeapon2) {
      try {
        const ws = getWeaponDisplayLength('strong');
        const obj = placeObjectOnGrid(scene, 6, 4, 'weapon', null, { width: ws.width, height: ws.height, color: 0xFFD700, weaponType: 'strong', weaponName: 'Golden Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon2 = obj;
      } catch (e) {
        const obj = placeObjectOnGrid(scene, 6, 4, 'weapon', null, { width: 14, height: 4, color: 0xFFD700, weaponType: 'strong', weaponName: 'Golden Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon2 = obj;
      }
    }
    if (!scene.collectedItems.meleeWeapon3) {
      try {
        const ws = getWeaponDisplayLength('fast');
        const obj = placeObjectOnGrid(scene, 8, 4, 'weapon', null, { width: ws.width, height: ws.height, color: 0x00FFFF, weaponType: 'fast', weaponName: 'Crystal Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon3 = obj;
      } catch (e) {
        const obj = placeObjectOnGrid(scene, 8, 4, 'weapon', null, { width: 10, height: 4, color: 0x00FFFF, weaponType: 'fast', weaponName: 'Crystal Pickaxe' });
        if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'weapon'; (obj as any).itemSubtype = (obj as any).weaponType; (obj as any).itemName = (obj as any).weaponName; }
        scene.meleeWeapon3 = obj;
      }
    }
    if (!scene.collectedItems.shield1) {
      const s1 = getShieldDisplaySize('basic');
      const obj = placeObjectOnGrid(scene, 12, 4, 'shield', null, { width: s1.width, height: s1.height, color: 0x654321, shieldType: 'basic', shieldName: 'Wooden Shield' });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'shield'; (obj as any).itemSubtype = (obj as any).shieldType; (obj as any).itemName = (obj as any).shieldName; }
      scene.shield1 = obj;
    }
    if (!scene.collectedItems.shield2) {
      const s2 = getShieldDisplaySize('strong');
      const obj = placeObjectOnGrid(scene, 14, 4, 'shield', null, { width: s2.width, height: s2.height, color: 0xC0C0C0, shieldType: 'strong', shieldName: 'Steel Shield' });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'shield'; (obj as any).itemSubtype = (obj as any).shieldType; (obj as any).itemName = (obj as any).shieldName; }
      scene.shield2 = obj;
    }
    if (!scene.collectedItems.shield3) {
      const s3 = getShieldDisplaySize('light');
      const obj = placeObjectOnGrid(scene, 16, 4, 'shield', null, { width: s3.width, height: s3.height, color: 0x4169E1, shieldType: 'light', shieldName: 'Magic Shield' });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'shield'; (obj as any).itemSubtype = (obj as any).shieldType; (obj as any).itemName = (obj as any).shieldName; }
      scene.shield3 = obj;
    }
    if (!scene.collectedItems.healthPotion1) {
      const obj = placeObjectOnGrid(scene, 4, 6, 'consumable', null, { width: 6, height: 10, color: 0xFF4444, consumableType: 'healthPotion', consumableName: 'Health Potion', healAmount: 25 });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'consumable'; (obj as any).itemSubtype = (obj as any).consumableType; (obj as any).itemName = (obj as any).consumableName; }
      scene.healthPotion1 = obj;
    }
    if (!scene.collectedItems.healthPotion2) {
      const obj = placeObjectOnGrid(scene, 6, 6, 'consumable', null, { width: 6, height: 10, color: 0xFF6666, consumableType: 'healingSalve', consumableName: 'Healing Salve', healAmount: 50 });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'consumable'; (obj as any).itemSubtype = (obj as any).consumableType; (obj as any).itemName = (obj as any).consumableName; }
      scene.healthPotion2 = obj;
    }
    if (!scene.collectedItems.staminaTonic1) {
      const obj = placeObjectOnGrid(scene, 8, 6, 'consumable', null, { width: 6, height: 10, color: 0x4488FF, consumableType: 'staminaTonic', consumableName: 'Stamina Tonic', staminaAmount: 30 });
      if (obj) { (obj as any).isShopItem = true; (obj as any).itemType = 'consumable'; (obj as any).itemSubtype = (obj as any).consumableType; (obj as any).itemName = (obj as any).consumableName; }
      scene.staminaTonic1 = obj;
    }
  }

  createDoorsForMap(scene);
  // Spawn gold ingots for this map from precomputed placements (if any)
  try {
    if (Array.isArray((scene as any).worldGoldPlacements)) {
      let idx = 1;
      for (const p of (scene as any).worldGoldPlacements) {
        if (p.mapId === scene.currentMap) {
          if (scene.collectedGoldIds && scene.collectedGoldIds.has(p.goldId)) continue;
          const obj = placeObjectOnGrid(scene, p.gx, p.gy, 'goldIngot', null, { goldId: p.goldId, width: 12, height: 6, color: 0xffd700 });
          if (obj) { (obj as any).goldId = p.goldId; (scene as any)[`goldIngot${idx}`] = obj; idx++; }
        }
      }
    }
  } catch (e) { console.warn('Gold spawn failed:', e); }
  try { generateMazeWalls(scene, { biome: getBiomeForMap(scene, scene.currentMap) }); } catch (e) { console.warn('Maze generation failed:', e); }

  scene.physics.add.collider(scene.player, scene.boundaryRocks);
  scene.physics.add.collider(scene.player, scene.treeTrunks);
  scene.physics.add.collider(scene.player, scene.buildingWalls);
  if (scene.mazeWalls) scene.physics.add.collider(scene.player, scene.mazeWalls);
  if (scene.shopCounter) scene.physics.add.collider(scene.player, scene.shopCounter);
  if (scene.enemiesGroup) {
    const blockNonBats = (a: any, b: any) => {
      const e = a?.enemyType ? a : (b?.enemyType ? b : null);
      // Only block if not bat and not lad
      return !(e && (e.enemyType === 'bat' || e.enemyType === 'lad'));
    };
    scene.physics.add.collider(scene.enemiesGroup, scene.boundaryRocks, null, blockNonBats, scene);
    scene.physics.add.collider(scene.enemiesGroup, scene.treeTrunks, null, blockNonBats, scene);
    scene.physics.add.collider(scene.enemiesGroup, scene.buildingWalls, null, blockNonBats, scene);
    if (scene.mazeWalls) scene.physics.add.collider(scene.enemiesGroup, scene.mazeWalls, null, blockNonBats, scene);
    if (scene.shopCounter) scene.physics.add.collider(scene.enemiesGroup, scene.shopCounter, null, blockNonBats, scene);
  }

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
  if (scene.goldIngot1) scene.physics.add.overlap(scene.player, scene.goldIngot1, scene.pickupGoldIngot, null, scene);

  if (scene.terrainZones) {
  const applySlow = (_player: any, zone: any) => {
      const f = Number.isFinite(zone.slowFactor) ? zone.slowFactor : 0.8;
      scene._terrainSlowFactor = Math.min(scene._terrainSlowFactor || 1, f);
      scene._terrainSlowUntil = scene.time.now + 100;
    };
    scene.physics.add.overlap(scene.player, scene.terrainZones, applySlow, null, scene);
  }

  // Tall grass rustle overlaps (player and enemies)
  if (scene.tallGrassSensors) {
    const RUSTLE_COOLDOWN = 250; // ms per sensor
    const rustle = (_entity: any, sensor: any) => {
      const now = scene.time.now | 0;
      if (sensor.lastRustleAt && now - sensor.lastRustleAt < RUSTLE_COOLDOWN) return;
      sensor.lastRustleAt = now;
      try { spawnGrassRustle(scene, sensor.x, sensor.y); } catch {}
    };
    try { scene.physics.add.overlap(scene.player, scene.tallGrassSensors, rustle, null, scene); } catch {}
    if (scene.enemiesGroup) {
      try { scene.physics.add.overlap(scene.enemiesGroup, scene.tallGrassSensors, rustle, null, scene); } catch {}
    }
  }

  // Ensure a persistent worldSeed exists before biome content so terrains are seeded per save
  if (!Number.isFinite(scene.worldSeed)) {
    scene.worldSeed = (Math.random() * 0xFFFFFFFF) >>> 0;
  }
  // Generate world gold placements once per world seed: 11 gold bars on distinct overworld tiles
  try {
    if (!scene.worldGoldPlacements) {
      const allOverworld = Object.keys(scene.maps || {}).filter(k => (scene.maps[k] && scene.maps[k].type === 'overworld'));
      const rng = rngFor(scene, 'goldPlacement');
      const count = Math.min(11, allOverworld.length);
      // sample without replacement
      const pool = allOverworld.slice();
      const chosen: string[] = [];
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(rng() * pool.length);
        chosen.push(pool.splice(idx, 1)[0]);
      }
      const Wg = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
      const Hg = Math.floor(scene.worldPixelHeight / scene.gridCellSize);
      const placements: Array<any> = [];
      for (let i = 0; i < chosen.length; i++) {
        const mapId = chosen[i];
        // pick a tile away from edges (2..Wg-3)
        const gx = randInt(rng, 2, Math.max(2, Wg - 3));
        const gy = randInt(rng, 2, Math.max(2, Hg - 3));
        placements.push({ mapId, gx, gy, goldId: `gold:${mapId}:${i}` });
      }
      scene.worldGoldPlacements = placements;
    }
  } catch (e) { console.warn('Gold placement generation failed:', e); }
  try { generateBiomeContent(scene); } catch (e) { console.warn('Biome generation failed:', e); }

  if (scene.gridVisible) createGridVisualization(scene);
}

export function createTerrainZone(scene: any, startGX: number, startGY: number, wTiles: number, hTiles: number, type: 'marsh'|'quicksand' = 'marsh', opts: any = {}) {
  // const cs = scene.gridCellSize;
  // const center = gridToWorld(scene, startGX, startGY);
  // const width = wTiles * cs;
  // const height = hTiles * cs;
  // const cx = center.x + (wTiles - 1) * cs / 2;
  // const cy = center.y + (hTiles - 1) * cs / 2;
  const styles: any = {
    marsh: { color: 0x3a6b5a, alpha: 0.35, stroke: 0x88d3b0, slowFactor: 0.9 },
    quicksand: { color: 0xD2B48C, alpha: 0.4, stroke: 0x8b6f47, slowFactor: 0.5 },
  };
  const st = { ...(styles[type] || styles.marsh), ...(opts.style || {}) };
  const cells: Array<{gx:number;gy:number}> = [];
  for (let dx = 0; dx < wTiles; dx++) {
    for (let dy = 0; dy < hTiles; dy++) {
      cells.push({ gx: startGX + dx, gy: startGY + dy });
    }
  }
  return createTerrainZoneFromCells(scene, cells, type, { ...opts, style: st });
}

export function createTerrainZoneFromCells(scene: any, cells: Array<{gx:number;gy:number}>, type: 'marsh'|'quicksand' = 'marsh', opts: any = {}) {
  if (!Array.isArray(cells) || cells.length === 0) return null;
  const cs = scene.gridCellSize;
  const baseStyles: any = {
    marsh: { color: 0x3a6b5a, alpha: 0.35, stroke: 0x88d3b0, slowFactor: 0.9 },
    quicksand: { color: 0xD2B48C, alpha: 0.4, stroke: 0x8b6f47, slowFactor: 0.5 },
  };
  const st = { ...(baseStyles[type] || baseStyles.marsh), ...(opts.style || {}) };
  const slowFactor = Number.isFinite(opts.slowFactor) ? opts.slowFactor : (st as any).slowFactor;
  const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;

  const container = scene.add.container(0, 0);
  container.setDepth(0);
  if (scene.worldLayer) scene.worldLayer.add(container);

  const tileRects: any[] = [];
  for (const { gx, gy } of cells) {
    const { x, y } = gridToWorld(scene, gx, gy);
    const r = scene.add.rectangle(x, y, cs, cs, (st as any).color, (st as any).alpha).setDepth(0);
    scene.physics.add.existing(r);
    r.body.setImmovable(true);
    r.terrainType = type;
    r.slowFactor = slowFactor;
    r.gx = gx; r.gy = gy;
    container.add(r);
    if (scene.terrainZones) scene.terrainZones.add(r);
    tileRects.push(r);
  }

  const g = scene.add.graphics();
  g.setDepth(0);
  const drawMarshLines = (baseX: number, baseY: number) => {
    const lines = 2 + Math.floor(rand() * 2);
    const pad = 3; g.lineStyle(1, 0x9fd3c0, 0.7);
    for (let i = 0; i < lines; i++) {
      const y = baseY - cs/2 + pad + (i+1) * ((cs - pad*2) / (lines + 1));
      const wiggle = (rand() - 0.5) * 4; g.beginPath(); g.moveTo(baseX - cs/2 + pad, y + wiggle); g.lineTo(baseX + cs/2 - pad, y - wiggle); g.strokePath();
    }
  };
  const drawQuicksandDots = (baseX: number, baseY: number) => {
    const blocks = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < blocks; i++) {
      const rx = (rand() - 0.5) * (cs - 4);
      const ry = (rand() - 0.5) * (cs - 3);
      const s = 1 + 2; g.fillStyle(0xf7ca8d, 0.9); g.fillRect(Math.round(baseX + rx - s / 2), Math.round(baseY + ry - s / 2), s, s);
    }
  };
  for (const r of tileRects) {
    if (type === 'marsh') drawMarshLines(r.x, r.y);
    else if (type === 'quicksand') drawQuicksandDots(r.x, r.y);
  }
  container.add(g);
  (container as any).pattern = g;
  (container as any).tiles = tileRects;
  if (scene.worldLayer) { try { scene.worldLayer.sendToBack(container); } catch {} }
  return container;
}

// Tall grass: purely visual, renders above characters; no physics or slow
export function createTallGrassZone(scene: any, startGX: number, startGY: number, wTiles: number, hTiles: number, opts: any = {}) {
  const cells: Array<{gx:number;gy:number}> = [];
  for (let dx = 0; dx < wTiles; dx++) for (let dy = 0; dy < hTiles; dy++) cells.push({ gx: startGX + dx, gy: startGY + dy });
  return createTallGrassZoneFromCells(scene, cells, opts);
}

export function createTallGrassZoneFromCells(scene: any, cells: Array<{gx:number;gy:number}>, opts: any = {}) {
  if (!Array.isArray(cells) || cells.length === 0) return null;
  const cs = scene.gridCellSize;
  const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;
  const occHas = (gx: number, gy: number) => !!scene.occupiedCells && scene.occupiedCells.has(`${gx},${gy}`);
  const drawCells = cells.filter(({ gx, gy }) => !occHas(gx, gy));
  if (drawCells.length === 0) return null;

  const container = scene.add.container(0, 0);
  // Above player/enemies and most ground props
  container.setDepth(5);
  if (scene.worldOverlayLayer) scene.worldOverlayLayer.add(container); else if (scene.worldLayer) scene.worldLayer.add(container);

  // Single graphics for all blades to keep object count low
  const g = scene.add.graphics();
  g.setDepth(5);
  // Optional base tint per tile for subtle grass density
  for (const { gx, gy } of drawCells) {
    const { x, y } = gridToWorld(scene, gx, gy);
    // light background hint (very subtle)
    if (opts.baseFill !== false) {
      const alpha = 0.10 + rand() * 0.05;
      g.fillStyle(0x2f6b2f, alpha);
      g.fillRect(Math.round(x - cs / 2), Math.round(y - cs / 2), cs, cs);
    }
    // Draw blades: 6-10 per tile, short vertical-ish lines with slight sway
    const blades = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < blades; i++) {
      const bx = x - cs / 2 + 3 + rand() * (cs - 6);
      const by = y + cs / 2 - 2 - rand() * (cs - 6);
      const h = 6 + rand() * 10; // blade height
      const sway = (rand() - 0.5) * 4;
      const color = rand() < 0.5 ? 0x69b36b : 0x4f9251;
      g.lineStyle(1, color, 0.95);
      g.beginPath();
      g.moveTo(Math.round(bx), Math.round(by));
      g.lineTo(Math.round(bx + sway), Math.round(by - h));
      g.strokePath();
      // occasional seed head
      if (rand() < 0.12) {
        g.fillStyle(0xaed39f, 0.9);
        g.fillRect(Math.round(bx + sway) - 1, Math.round(by - h) - 1, 2, 2);
      }
    }
  }
  container.add(g);

  // Add invisible overlap sensors for rustle; keep in a group for physics overlap
  if (scene.tallGrassSensors) {
    for (const { gx, gy } of drawCells) {
      if (scene.occupiedCells && scene.occupiedCells.has(`${gx},${gy}`)) continue;
      const { x, y } = gridToWorld(scene, gx, gy);
      const sensor = scene.add.rectangle(x, y, cs, cs, 0x00ff00, 0.001);
      scene.physics.add.existing(sensor);
      sensor.body.setAllowGravity(false);
      sensor.body.setImmovable(true);
      sensor.body.setCircle?.(undefined);
      sensor.isTallGrassSensor = true;
      scene.tallGrassSensors.add(sensor);
      // Sensors are logic-only; attach to base worldLayer so they scroll with map
      if (scene.worldLayer) scene.worldLayer.add(sensor);
    }
  }
  return container;
}

// Quick rustle VFX: brief lines flicker to simulate movement in grass
export function spawnGrassRustle(scene: any, x: number, y: number) {
  const g = scene.add.graphics();
  const r = rngFor(scene, 'rustle');
  const life = 180; // ms
  const draw = () => {
    g.clear();
    // 6 random flicker strokes around center
    for (let i = 0; i < 6; i++) {
      const angle = r() * Math.PI * 2;
      const len = 4 + r() * 8;
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      g.lineStyle(1, 0xaed39f, 0.9);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + dx, y + dy);
      g.strokePath();
    }
  };
  draw();
  // Place in overlay above characters
  try { scene.worldOverlayLayer?.add(g); } catch {}
  g.setDepth(4);
  scene.tweens.add({ targets: g, alpha: 0, duration: life, onComplete: () => { try { g.destroy(); } catch {} } });
}

export function getEdgeEntranceCells(scene: any) {
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const cells = new Set<string>();
  for (const [doorId, d] of Object.entries<any>(mapDoors)) {
    if (!d || !d.type) continue;
    const half = getEffectiveEdgeHalfWidth(scene, scene.currentMap, doorId, d);
    if (d.type === 'edge_north') {
      const gy = 0; for (let gx = Math.max(0, d.gridX - half); gx <= Math.min(maxGX, d.gridX + half); gx++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_south') {
      const gy = maxGY; for (let gx = Math.max(0, d.gridX - half); gx <= Math.min(maxGX, d.gridX + half); gx++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_west') {
      const gx = 0; for (let gy = Math.max(0, d.gridY - half); gy <= Math.min(maxGY, d.gridY + half); gy++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_east') {
      const gx = maxGX; for (let gy = Math.max(0, d.gridY - half); gy <= Math.min(maxGY, d.gridY + half); gy++) cells.add(`${gx},${gy}`);
    }
  }
  return cells;
}
