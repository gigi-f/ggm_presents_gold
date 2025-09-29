/*
 AI-INDEX
 - Tags: mechanics.doors, mechanics.economy, mechanics.buildings
 - See: docs/ai/index.json
*/
import { MAP_IDS, DOOR_IDS } from './constants';
import { getCurrencySpec } from './economy.js';
import { createShopBuilding as genShop } from './buildings.js';
import * as Enemies from './enemies.js';
import { createShopkeeperSprite } from './npcSprites.js';
import { generateBiomeContent, getBiomeForMap } from './biomes.js';
import { generateMazeWalls } from './maze.js';

export function initializeGrid(scene) {
  scene.gridWidth = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  scene.gridHeight = Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  scene.occupiedCells = new Set();
  scene.gridVisible = false;
  scene.gridLines = null;
  // Terrain zones (non-blocking floor effects)
  scene.terrainZones = scene.add ? scene.add.group() : null;
}

// Legacy helper retained for compatibility; prefer computeEdgeOpenRanges
export function isInEdgeGap(scene, index, skipSet) {
  // With new system, skipSet contains exact indices; treat as direct membership
  return skipSet?.has(index) || false;
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

/**
 * Quantize an arbitrary world position to the center of a grid tile.
 * Extensible options allow different rounding strategies, interior clamping, and offsets.
 *
 * Options:
 * - mode: 'nearest' | 'floor' | 'ceil' (default: 'nearest')
 * - interior: boolean — if true, clamps to interior cells [1..W-2, 1..H-2]; if false, allows edge cells [0..W-1] (default: true)
 * - offsetX/offsetY: number — pixel offsets to add after centering (default: 0)
 * - markOccupied: boolean — mark the chosen grid cell as occupied in scene.occupiedCells (default: false)
 *
 * Returns { x, y, gridX, gridY } where (x,y) is the quantized world-center.
 */
export function quantizeWorldPosition(scene, worldX, worldY, opts = {}) {
  const cs = scene.gridCellSize || 16;
  const W = scene.gridWidth ?? Math.floor(scene.worldPixelWidth / cs);
  const H = scene.gridHeight ?? Math.floor(scene.worldPixelHeight / cs);
  const interior = (opts.interior !== undefined) ? !!opts.interior : true;
  const mode = opts.mode || 'nearest';
  const clampMinGX = interior ? 1 : 0;
  const clampMinGY = interior ? 1 : 0;
  const clampMaxGX = interior ? (W - 2) : (W - 1);
  const clampMaxGY = interior ? (H - 2) : (H - 1);

  const roundIdx = (value) => {
    if (mode === 'floor') return Math.floor(value);
    if (mode === 'ceil') return Math.ceil(value);
    return Math.round(value); // nearest
  };

  // Centers live at (n + 0.5) * cs, so find n via rounding (world/cs - 0.5)
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

/**
 * Quantize a display object (e.g., sprite) to the center of the nearest grid tile.
 * Updates obj.x/obj.y and optionally its Arcade body.
 *
 * Options are the same as quantizeWorldPosition, plus:
 * - snapBody: boolean — also snap Arcade body position (if present) (default: true)
 */
export function quantizeObjectToGrid(scene, obj, opts = {}) {
  if (!obj) return null;
  const q = quantizeWorldPosition(scene, obj.x, obj.y, opts);
  obj.x = q.x; obj.y = q.y;
  // Keep Arcade body in sync if present
  const snapBody = opts.snapBody !== undefined ? !!opts.snapBody : true;
  try {
    if (snapBody && obj.body && obj.body.type === (scene.physics?.world?.ARCADE || 0)) {
      // body.reset centers a dynamic body at given coordinates
      if (typeof obj.body.reset === 'function') obj.body.reset(q.x, q.y);
      else { obj.body.x = q.x - obj.body.halfWidth; obj.body.y = q.y - obj.body.halfHeight; }
    }
  } catch {}
  return q;
}

// Find the nearest free grid cell to the desired world position and return its world center.
// Respects interior bounds (excludes border cells) and occupiedCells (maze, walls, props).
export function findNearestFreeWorldPosition(scene, desiredX, desiredY, opts = {}) {
  const maxRadius = Number.isFinite(opts.maxRadius) ? Math.max(1, opts.maxRadius) : 6;
  const { gridX: sx, gridY: sy } = worldToGrid(scene, desiredX, desiredY);
  const W = scene.gridWidth ?? Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  const H = scene.gridHeight ?? Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  const inInterior = (gx, gy) => gx >= 1 && gx <= W - 2 && gy >= 1 && gy <= H - 2;
  const free = (gx, gy) => inInterior(gx, gy) && isGridCellAvailable(scene, gx, gy);
  if (free(sx, sy)) return gridToWorld(scene, sx, sy);
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        // Check perimeter of the square ring only for efficiency
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const gx = sx + dx, gy = sy + dy;
        if (free(gx, gy)) return gridToWorld(scene, gx, gy);
      }
    }
  }
  // Fallback: center of the map if nothing found
  const fallbackGX = Math.max(1, Math.min(W - 2, Math.floor(W / 2)));
  const fallbackGY = Math.max(1, Math.min(H - 2, Math.floor(H / 2)));
  return gridToWorld(scene, fallbackGX, fallbackGY);
}

export function createDoorContainer(scene, worldX, worldY, kind = 'entrance', meta = {}) {
  const container = scene.add.container(worldX, worldY);
  // Ensure door renders above buildings and wall collisions
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
    
    case 'weapon': {
      obj = scene.add.rectangle(worldPos.x, worldPos.y, extraData.width, extraData.height, extraData.color);
      scene.physics.add.existing(obj);
      obj.body.setImmovable(true);
      obj.weaponType = extraData.weaponType;
      obj.weaponName = extraData.weaponName;
      if (scene.worldLayer) scene.worldLayer.add(obj);
      break;
    }
    case 'goldIngot': {
      // Gold ingot collectible (win condition, not currency)
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
      const worldPos = gridToWorld(scene, gx, gy);
      // Compute effective half-width (tiles): honor per-door width, enforce overworld minimum, and match linked door
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
      sensor.isEdgeExit = true;
      sensor.doorId = doorId;
      if (scene.worldLayer) scene.worldLayer.add(sensor);
      scene.activeDoors[doorId] = sensor;
      scene.physics.add.overlap(scene.player, sensor, scene.handleEdgeExit, () => !scene.transitionLock, scene);
    }
  }
}

function computeEdgeOpenRanges(scene) {
  // Returns sets of indices for open gaps per edge: { top:Set(gx), bottom:Set(gx), left:Set(gy), right:Set(gy) }
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const openTop = new Set();
  const openBottom = new Set();
  const openLeft = new Set();
  const openRight = new Set();
  const maxGX = (scene.gridWidth ?? Math.floor(scene.worldPixelWidth / scene.gridCellSize)) - 1;
  const maxGY = (scene.gridHeight ?? Math.floor(scene.worldPixelHeight / scene.gridCellSize)) - 1;
  for (const [, d] of Object.entries(mapDoors)) {
    const half = getEffectiveEdgeHalfWidth(scene, scene.currentMap, d.doorId || d.id || Object.keys(mapDoors).find(k => mapDoors[k] === d), d);
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

// Compute the effective half-width (in tiles) for an edge entrance:
// - Uses doorData.entranceHalfWidth or scene.edgeGapRadius as base
// - Enforces a minimum of 1 (i.e., >= 3-tile gap) for overworld maps
// - Matches width across linked doors by taking the max of both sides
function getEffectiveEdgeHalfWidth(scene, mapId, doorId, doorData) {
  const baseFrom = (d, mapType) => {
    const raw = Number.isFinite(d?.entranceHalfWidth) ? Math.floor(d.entranceHalfWidth) : Math.floor(scene.edgeGapRadius ?? 0);
    const half = Math.max(0, raw);
    // Ensure at least 2 tiles wide → with centered odd spans this means half >= 1 (3 tiles)
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

export function createMapObjects(scene, options = {}) {
  scene.occupiedCells.clear();
  if (!options.preserveExistingWorld && scene.worldLayer) scene.worldLayer.destroy(true);
  if (!options.buildIntoExistingWorldLayer || !scene.worldLayer) scene.worldLayer = scene.add.container(0, 0);
  scene.activeDoors = {};
  if (!scene.boundaryRocks) scene.boundaryRocks = scene.add.group();
  if (!scene.treeTrunks) scene.treeTrunks = scene.add.group();
  if (!scene.buildingWalls) scene.buildingWalls = scene.add.group();
  if (!scene.enemiesGroup) scene.enemiesGroup = scene.add.group();
  if (!scene.terrainZones) scene.terrainZones = scene.add.group();
  // Clear prior terrain zones
  if (scene.terrainZones) scene.terrainZones.clear(true, true);
  // Clear previous building wall colliders to avoid stale collision blocking
  if (scene.buildingWalls) {
    scene.buildingWalls.clear(true, true);
  }
  // Clear existing enemies on rebuild unless preserved (for persistence across transitions/boss rooms)
  if (scene.enemiesGroup && !options.preserveEnemies) {
    scene.enemiesGroup.clear(true, true);
  }
  // Clear any stale shopkeeper/counter references when rebuilding the world layer to avoid missing NPCs
  if (!options.preserveExistingWorld) {
    if (scene.shopkeeper) {
      try { if (scene.shopkeeper.label) scene.shopkeeper.label.destroy(); } catch (e) { /* noop */ }
      try { scene.shopkeeper.destroy(); } catch (e) { /* noop */ }
      scene.shopkeeper = null;
    }
    if (scene._shopkeeperGunSprite) {
      try { scene._shopkeeperGunSprite.destroy(); } catch (e) { /* noop */ }
      scene._shopkeeperGunSprite = null;
    }
    if (scene.shopCounter) {
      try { scene.shopCounter.destroy(); } catch (e) { /* noop */ }
      scene.shopCounter = null;
    }
  }

  const currentMapData = scene.maps[scene.currentMap];
  const isShop = currentMapData.type === 'shop';
  const cs = scene.gridCellSize;
  const W = scene.worldPixelWidth;
  const H = scene.worldPixelHeight;

  const open = computeEdgeOpenRanges(scene);

  for (let x = 0; x < W; x += cs) {
    const gx = Math.floor(x / cs);
  if (open.top.has(gx)) continue;
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
  if (open.bottom.has(gx)) continue;
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
  if (open.left.has(gy)) continue;
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
  if (open.right.has(gy)) continue;
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

    // Example GOLD ingot (win-condition collectible) placed in the starting map tile
    const spawnGold = (id, gx, gy) => {
      if (scene.collectedGoldIds && scene.collectedGoldIds.has(id)) return;
      const obj = placeObjectOnGrid(scene, gx, gy, 'goldIngot', null, { goldId: id, width: 12, height: 6, color: 0xffd700 });
      if (obj) obj.goldId = id;
      return obj;
    };
    // Place near center but slightly offset so it doesn't overlap spawn
  // Place away from player spawn (player spawns around grid ~12,9)
  scene.goldIngot1 = spawnGold('gold:ow1:1', 16, 12);
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_02) {
    // Desert content will be generated via biome generator
  } else if (scene.currentMap === MAP_IDS.OVERWORLD_00) {
    scene.treeTrunks.clear();
    // Forest content will be generated via biome generator
  } else if (scene.currentMap === MAP_IDS.SHOP_01) {
    scene.treeTrunks.clear();
    // Shop is now clear of obstacles - place all items here instead
    // Create a counter to block access to items behind it
    const left = gridToWorld(scene, 2, 6);
    const right = gridToWorld(scene, Math.floor(scene.worldPixelWidth / scene.gridCellSize) - 2, 6);
    const width = right.x - left.x;
    const counter = scene.add.rectangle(left.x + width / 2, left.y, width, 8, 0x5a3b2e);
    scene.physics.add.existing(counter);
    counter.body.setImmovable(true);
    counter.setDepth(1);
    scene.shopCounter = counter;
    if (scene.worldLayer) scene.worldLayer.add(counter);
    // Place a shopkeeper NPC near the back counter
  const pos = gridToWorld(scene, 10, 6);
  // Procedural shopkeeper sprite with deterministic seed for this shop
  const seed = `${scene.currentMap}:keeper:main`;
  scene.shopkeeper = createShopkeeperSprite(scene, pos.x, pos.y, { seed });
  if (scene.worldLayer) scene.worldLayer.add(scene.shopkeeper);
  // Add a simple name tag
  const label = scene.add.text(pos.x, pos.y - (scene.shopkeeper.npcConfig?.heightPx ?? 18) - 2, 'Shopkeep', { fontSize: '7px', color: '#fff' });
  label.setOrigin(0.5, 1);
  label.setDepth(2);
  if (scene.worldLayer) scene.worldLayer.add(label);
  scene.shopkeeper.label = label;
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
    // Add health potions to the shop
    if (!scene.collectedItems.healthPotion1) {
      const obj = placeObjectOnGrid(scene, 4, 6, 'consumable', null, { width: 6, height: 10, color: 0xFF4444, consumableType: 'healthPotion', consumableName: 'Health Potion', healAmount: 25 });
      if (obj) { obj.isShopItem = true; obj.itemType = 'consumable'; obj.itemSubtype = obj.consumableType; obj.itemName = obj.consumableName; }
      scene.healthPotion1 = obj;
    }
    if (!scene.collectedItems.healthPotion2) {
      const obj = placeObjectOnGrid(scene, 6, 6, 'consumable', null, { width: 6, height: 10, color: 0xFF6666, consumableType: 'healingSalve', consumableName: 'Healing Salve', healAmount: 50 });
      if (obj) { obj.isShopItem = true; obj.itemType = 'consumable'; obj.itemSubtype = obj.consumableType; obj.itemName = obj.consumableName; }
      scene.healthPotion2 = obj;
    }
    if (!scene.collectedItems.staminaTonic1) {
      const obj = placeObjectOnGrid(scene, 8, 6, 'consumable', null, { width: 6, height: 10, color: 0x4488FF, consumableType: 'staminaTonic', consumableName: 'Stamina Tonic', staminaAmount: 30 });
      if (obj) { obj.isShopItem = true; obj.itemType = 'consumable'; obj.itemSubtype = obj.consumableType; obj.itemName = obj.consumableName; }
      scene.staminaTonic1 = obj;
    }
  }

  createDoorsForMap(scene);
  // Generate maze walls before wiring colliders so physics includes them (pass biome for style bias)
  try { generateMazeWalls(scene, { biome: getBiomeForMap(scene, scene.currentMap) }); } catch (e) { console.warn('Maze generation failed:', e); }

  // Colliders (after maze so new group is included)
  scene.physics.add.collider(scene.player, scene.boundaryRocks);
  scene.physics.add.collider(scene.player, scene.treeTrunks);
  scene.physics.add.collider(scene.player, scene.buildingWalls);
  if (scene.mazeWalls) scene.physics.add.collider(scene.player, scene.mazeWalls);
  if (scene.shopCounter) scene.physics.add.collider(scene.player, scene.shopCounter);
  // Enemies should respect world collisions, except flying enemies (bats) which can pass over
  if (scene.enemiesGroup) {
    const blockNonBats = (a, b) => {
      const e = a?.enemyType ? a : (b?.enemyType ? b : null);
      return !(e && e.enemyType === 'bat');
    };
    scene.physics.add.collider(scene.enemiesGroup, scene.boundaryRocks, null, blockNonBats, scene);
    scene.physics.add.collider(scene.enemiesGroup, scene.treeTrunks, null, blockNonBats, scene);
    scene.physics.add.collider(scene.enemiesGroup, scene.buildingWalls, null, blockNonBats, scene);
    if (scene.mazeWalls) scene.physics.add.collider(scene.enemiesGroup, scene.mazeWalls, null, blockNonBats, scene);
    if (scene.shopCounter) scene.physics.add.collider(scene.enemiesGroup, scene.shopCounter, null, blockNonBats, scene);
  }

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
  if (scene.goldIngot1) scene.physics.add.overlap(scene.player, scene.goldIngot1, scene.pickupGoldIngot, null, scene);

  // Terrain zones: overlap to apply slow effect briefly; keep renewing while overlapping
  if (scene.terrainZones) {
    // Clear any prior overlap handlers by recreating overlaps each build
    const applySlow = (player, zone) => {
      const f = Number.isFinite(zone.slowFactor) ? zone.slowFactor : 0.8;
      scene._terrainSlowFactor = Math.min(scene._terrainSlowFactor || 1, f);
      scene._terrainSlowUntil = scene.time.now + 100; // refresh for 100ms; renewed every frame if still overlapping
    };
    scene.physics.add.overlap(scene.player, scene.terrainZones, applySlow, null, scene);
  }

  // Generate biome-specific props and enemies after core map scaffolding
  try { generateBiomeContent(scene); } catch (e) { console.warn('Biome generation failed:', e); }

  if (scene.gridVisible) createGridVisualization(scene);
}

// Create a non-blocking terrain zone (e.g., marsh, quicksand) covering a rectangle of grid cells.
// Does not mark cells as occupied to allow other placements; purely visual + overlap effect.
export function createTerrainZone(scene, startGX, startGY, wTiles, hTiles, type = 'marsh', opts = {}) {
  const cs = scene.gridCellSize;
  const center = gridToWorld(scene, startGX, startGY);
  const width = wTiles * cs;
  const height = hTiles * cs;
  const cx = center.x + (wTiles - 1) * cs / 2;
  const cy = center.y + (hTiles - 1) * cs / 2;
  // Visual style per type
  const styles = {
    marsh: { color: 0x3a6b5a, alpha: 0.35, stroke: 0x88d3b0, slowFactor: 0.9 },
    quicksand: { color: 0xD2B48C, alpha: 0.4, stroke: 0x8b6f47, slowFactor: 0.5 },
  };
  const st = { ...(styles[type] || styles.marsh), ...(opts.style || {}) };
  // Default: build rectangular footprint of cells
  const cells = [];
  for (let dx = 0; dx < wTiles; dx++) {
    for (let dy = 0; dy < hTiles; dy++) {
      cells.push({ gx: startGX + dx, gy: startGY + dy });
    }
  }
  return createTerrainZoneFromCells(scene, cells, type, { ...opts, style: st });
}

// Create terrain zone from a list of grid cells. Adds one physics rectangle per cell (overlap sensor)
// and draws a pattern overlay for visual texture.
export function createTerrainZoneFromCells(scene, cells, type = 'marsh', opts = {}) {
  if (!Array.isArray(cells) || cells.length === 0) return null;
  const cs = scene.gridCellSize;
  // Visual style
  const baseStyles = {
    marsh: { color: 0x3a6b5a, alpha: 0.35, stroke: 0x88d3b0, slowFactor: 0.9 },
    quicksand: { color: 0xD2B48C, alpha: 0.4, stroke: 0x8b6f47, slowFactor: 0.5 },
  };
  const st = { ...(baseStyles[type] || baseStyles.marsh), ...(opts.style || {}) };
  const slowFactor = Number.isFinite(opts.slowFactor) ? opts.slowFactor : st.slowFactor;
  const rand = typeof opts.rand === 'function' ? opts.rand : Math.random;

  // Optional container just to help z-ordering and grouping visuals
  const container = scene.add.container(0, 0);
  container.setDepth(0);
  if (scene.worldLayer) scene.worldLayer.add(container);

  // Draw cells and physics
  const tileRects = [];
  for (const { gx, gy } of cells) {
    const { x, y } = gridToWorld(scene, gx, gy);
    const r = scene.add.rectangle(x, y, cs, cs, st.color, st.alpha).setDepth(0);
    scene.physics.add.existing(r);
    r.body.setImmovable(true);
    r.terrainType = type;
    r.slowFactor = slowFactor;
    r.gx = gx; r.gy = gy;
    container.add(r);
    if (scene.terrainZones) scene.terrainZones.add(r);
    tileRects.push(r);
  }

  // Pattern overlay: single Graphics for all cells in this zone
  const g = scene.add.graphics();
  g.setDepth(0);
  const drawMarshLines = (baseX, baseY) => {
    const lines = 2 + Math.floor(rand() * 2); // 2-3
    const pad = 3;
    g.lineStyle(1, 0x9fd3c0, 0.7);
    for (let i = 0; i < lines; i++) {
      const y = baseY - cs/2 + pad + (i+1) * ((cs - pad*2) / (lines + 1));
      const wiggle = (rand() - 0.5) * 4;
      g.beginPath();
      g.moveTo(baseX - cs/2 + pad, y + wiggle);
      g.lineTo(baseX + cs/2 - pad, y - wiggle);
      g.strokePath();
    }
  };
  const drawQuicksandDots = (baseX, baseY) => {
    // Draw small square blocks for a more grainy, blocky quicksand look
    const blocks = 4 + Math.floor(rand() * 3); // 4-6
    for (let i = 0; i < blocks; i++) {
      const rx = (rand() - 0.5) * (cs - 4);
      const ry = (rand() - 0.5) * (cs - 3);
      const s = 1 + 2; // 2..4 px square
      g.fillStyle(0xf7ca8d, 0.9);
      g.fillRect(Math.round(baseX + rx - s / 2), Math.round(baseY + ry - s / 2), s, s);
    }
  };
  // Draw per tile
  for (const r of tileRects) {
    if (type === 'marsh') drawMarshLines(r.x, r.y);
    else if (type === 'quicksand') drawQuicksandDots(r.x, r.y);
  }
  // Attach pattern graphics to the zone container
  container.add(g);
  container.pattern = g;
  container.tiles = tileRects;
  // Ensure the entire terrain zone (tiles + pattern) is beneath obstacles/maze
  if (scene.worldLayer) {
    try { scene.worldLayer.sendToBack(container); } catch (e) { /* noop */ }
  }
  return container;
}

// Return a Set of "gx,gy" strings for all edge entrance cells (north/south/east/west) on the current map.
export function getEdgeEntranceCells(scene) {
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  const mapDoors = scene.doorRegistry[scene.currentMap] || {};
  const cells = new Set();
  for (const [doorId, d] of Object.entries(mapDoors)) {
    if (!d || !d.type) continue;
    const half = getEffectiveEdgeHalfWidth(scene, scene.currentMap, doorId, d);
    if (d.type === 'edge_north') {
      const gy = 0;
      for (let gx = Math.max(0, d.gridX - half); gx <= Math.min(maxGX, d.gridX + half); gx++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_south') {
      const gy = maxGY;
      for (let gx = Math.max(0, d.gridX - half); gx <= Math.min(maxGX, d.gridX + half); gx++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_west') {
      const gx = 0;
      for (let gy = Math.max(0, d.gridY - half); gy <= Math.min(maxGY, d.gridY + half); gy++) cells.add(`${gx},${gy}`);
    } else if (d.type === 'edge_east') {
      const gx = maxGX;
      for (let gy = Math.max(0, d.gridY - half); gy <= Math.min(maxGY, d.gridY + half); gy++) cells.add(`${gx},${gy}`);
    }
  }
  return cells;
}
