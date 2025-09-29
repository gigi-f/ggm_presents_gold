/*
 AI-INDEX
 - Tags: world.biomes, mechanics.enemies
 - See: docs/ai/index.json
*/
import { MAP_IDS } from './constants';
import * as Enemies from './enemies.js';
import { placeObjectOnGrid, getEdgeEntranceCells, createTerrainZone, createTerrainZoneFromCells } from './world.js';

// Simple deterministic PRNG (mulberry32)
function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function getBiomeForMap(scene, mapId) {
  const id = mapId ?? scene.currentMap;
  switch (id) {
    case MAP_IDS.OVERWORLD_00: return 'forest';
    case MAP_IDS.OVERWORLD_01: return 'plains';
    case MAP_IDS.OVERWORLD_02: return 'desert';
    case MAP_IDS.OVERWORLD_03: return 'plains';
    default: return 'plains';
  }
}

export function generateBiomeContent(scene) {
  const currentMapData = scene.maps[scene.currentMap];
  if (!currentMapData || currentMapData.type !== 'overworld') return;
  const biome = getBiomeForMap(scene, scene.currentMap);

  // Build a buffer around overworld edge entrances so props are at least two tiles away
  const doors = scene.doorRegistry[scene.currentMap] || {};
  const edgeCells = getEdgeEntranceCells(scene);
  const bufferCells = new Set();
  const csW = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  const csH = Math.floor(scene.worldPixelHeight / scene.gridCellSize);
  for (const key of edgeCells) {
    const [gx0, gy0] = key.split(',').map(Number);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) {
          const gx = gx0 + dx, gy = gy0 + dy;
          if (gx >= 0 && gy >= 0 && gx < csW && gy < csH) bufferCells.add(`${gx},${gy}`);
        }
      }
    }
  }
  // Also avoid the exact door cell positions (building doors, etc.)
  for (const d of Object.values(doors)) bufferCells.add(`${d.gridX},${d.gridY}`);

  // Seed RNG by map id for determinism across runs
  const seed = (typeof scene.currentMap === 'number' ? scene.currentMap : String(scene.currentMap).split('').reduce((a,c)=>a+c.charCodeAt(0),0)) + 12345;
  const rand = mulberry32(seed);

  // Helper to try place an object avoiding occupied & door cells
  const tryPlace = (gx, gy, type, group, data) => {
    if (gx < 1 || gy < 1) return null;
    if (bufferCells.has(`${gx},${gy}`)) return null;
    if (!scene.isGridCellAvailable(gx, gy)) return null;
    return placeObjectOnGrid(scene, gx, gy, type, group, data);
  };
  // Helper: try place terrain zone (doesn't occupy cells but avoid doors/buffers)
  const tryTerrain = (gx, gy, w, h, type, opts={}) => {
    // Keep entire rect inside inner bounds
    if (gx < 1 || gy < 1) return null;
    if (gx + w > csW - 1 || gy + h > csH - 1) return null;
    // Build base cells
    const cells = [];
    for (let ix = 0; ix < w; ix++) for (let iy = 0; iy < h; iy++) cells.push({ gx: gx + ix, gy: gy + iy });
    // Add organic single-tile tails along edges (1-3 tails); ensure at least one succeeds
    const tails = 1 + Math.floor(rand() * 3);
    const tryAdd = (tgx, tgy) => {
      if (tgx < 1 || tgy < 1 || tgx >= csW - 1 || tgy >= csH - 1) return;
      const k = `${tgx},${tgy}`; if (bufferCells.has(k)) return;
      if (!cells.some(c => c.gx === tgx && c.gy === tgy)) cells.push({ gx: tgx, gy: tgy });
    };
    let addedAnyTail = false;
    for (let t = 0; t < tails; t++) {
      // choose an edge tile to extend from
      const fromIdx = Math.floor(rand() * cells.length);
      const from = cells[fromIdx];
      const dir = Math.floor(rand() * 4);
      const dx = [1,-1,0,0][dir];
      const dy = [0,0,1,-1][dir];
      const beforeLen = cells.length;
      tryAdd(from.gx + dx, from.gy + dy);
      if (cells.length > beforeLen) addedAnyTail = true;
    }
    // If no random tail was added (due to buffers/bounds), force a deterministic adjacent cell
    if (!addedAnyTail) {
      // pick a border cell of the rectangle and push one outward if legal
      const candidates = [];
      for (const c of cells) {
        const onEdge = (c.gx === gx || c.gx === gx + w - 1 || c.gy === gy || c.gy === gy + h - 1);
        if (!onEdge) continue;
        candidates.push(c);
      }
      // deterministic pick from candidates
      const idx = candidates.length ? Math.floor(rand() * candidates.length) : 0;
      const base = candidates[idx] || { gx, gy };
      const dirs = [ [1,0], [-1,0], [0,1], [0,-1] ];
      for (const [dx, dy] of dirs) {
        const nx = base.gx + dx, ny = base.gy + dy;
        const k = `${nx},${ny}`;
        const inBounds = nx >= 1 && ny >= 1 && nx < csW - 1 && ny < csH - 1;
        const notInsideRect = !(nx >= gx && nx < gx + w && ny >= gy && ny < gy + h);
        if (inBounds && notInsideRect && !bufferCells.has(k) && !cells.some(c => c.gx === nx && c.gy === ny)) {
          cells.push({ gx: nx, gy: ny });
          addedAnyTail = true;
          break;
        }
      }
    }
    // Avoid door-adjacent buffer for entire shape
    for (const c of cells) { if (bufferCells.has(`${c.gx},${c.gy}`)) return null; }
    return createTerrainZoneFromCells(scene, cells, type, opts);
  };

  // Density and object palette per biome
  const Wg = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  const Hg = Math.floor(scene.worldPixelHeight / scene.gridCellSize);

  if (biome === 'forest') {
    // Tree props removed: maze walls now provide overworld obstacles
    // Enemies: slimes prefer forests
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 60 }); } catch {}
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 55 }); } catch {}
    // Marsh patches: 1-3 patches, up to 5x5, random sizes and positions
    const marshPatches = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < marshPatches; i++) {
      const w = 2 + Math.floor(rand() * 4); // 2..5
      const h = 2 + Math.floor(rand() * 4); // 2..5
      const gx = 1 + Math.floor(rand() * (Wg - w - 2));
      const gy = 1 + Math.floor(rand() * (Hg - h - 2));
      tryTerrain(gx, gy, w, h, 'marsh', { slowFactor: 0.85, rand });
    }
  } else if (biome === 'desert') {
    // Cactus props removed: maze walls now provide overworld obstacles
    // Enemies: bats over deserts (windy open)
    try { Enemies.spawnBatAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 90, aggroRadius: 64 }); } catch {}
    if (rand() < 0.5) { try { Enemies.spawnBatAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 80, aggroRadius: 56 }); } catch {} }
    // Quicksand tiles: limit count per map to prevent frustration
    const maxPatches = 3; // cap number of quicksand zones
    const attempts = 8;
    let placed = 0;
    for (let i = 0; i < attempts && placed < maxPatches; i++) {
      const w = 2 + Math.floor(rand() * 3); // 2..4
      const h = 2 + Math.floor(rand() * 3); // 2..4
      const gx = 1 + Math.floor(rand() * (Wg - w - 2));
      const gy = 1 + Math.floor(rand() * (Hg - h - 2));
      const node = tryTerrain(gx, gy, w, h, 'quicksand', { slowFactor: 0.55, rand });
      if (node) placed++;
    }
  } else { // plains
    // Tree props removed: maze walls now provide overworld obstacles
    // Enemies: occasional slime
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 58 }); } catch {}
    // Add wolves only on non-starting plains maps to avoid overwhelming new players
    if (scene.currentMap !== MAP_IDS.OVERWORLD_01) {
      const wolfCount = 1 + (rand() < 0.5 ? 1 : 0);
      for (let i = 0; i < wolfCount; i++) {
        const gx = 2 + Math.floor(rand() * (Wg - 4));
        const gy = 2 + Math.floor(rand() * (Hg - 4));
        try { Enemies.spawnWolfAtGrid(scene, gx, gy, { aggroRadius: 200, deaggroRadius: 360, chargeSpeed: 280, speed: 120, damage: 12 }); } catch {}
      }
    }
  }
}
