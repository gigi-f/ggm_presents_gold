/*
 AI-INDEX
 - Tags: world.biomes, mechanics.enemies
 - See: docs/ai/index.json
*/
import { MAP_IDS } from './constants';
import * as Enemies from './enemies.js';
import { placeObjectOnGrid, getEdgeEntranceCells } from './world.js';

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

  // Density and object palette per biome
  const Wg = Math.floor(scene.worldPixelWidth / scene.gridCellSize);
  const Hg = Math.floor(scene.worldPixelHeight / scene.gridCellSize);

  if (biome === 'forest') {
    const count = 12 + Math.floor(rand() * 6); // 12-17
    for (let i = 0; i < count; i++) {
      const gx = 2 + Math.floor(rand() * (Wg - 4));
      const gy = 2 + Math.floor(rand() * (Hg - 4));
      const t = rand();
      const type = t < 0.4 ? 'treeTrunkSmall' : (t < 0.75 ? 'treeTrunkMedium' : 'treeTrunkLarge');
      tryPlace(gx, gy, type, scene.treeTrunks);
    }
    // Enemies: slimes prefer forests
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 60 }); } catch {}
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 55 }); } catch {}
  } else if (biome === 'desert') {
    const count = 6 + Math.floor(rand() * 5); // 6-10
    for (let i = 0; i < count; i++) {
      const gx = 2 + Math.floor(rand() * (Wg - 4));
      const gy = 2 + Math.floor(rand() * (Hg - 4));
      tryPlace(gx, gy, 'cactus', scene.treeTrunks, { height: 12 + Math.floor(rand() * 8) });
    }
    // Enemies: bats over deserts (windy open)
    try { Enemies.spawnBatAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 90, aggroRadius: 64 }); } catch {}
    if (rand() < 0.5) { try { Enemies.spawnBatAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 80, aggroRadius: 56 }); } catch {} }
  } else { // plains
    const count = 3 + Math.floor(rand() * 3); // 3-5
    for (let i = 0; i < count; i++) {
      const gx = 2 + Math.floor(rand() * (Wg - 4));
      const gy = 2 + Math.floor(rand() * (Hg - 4));
      const t = rand();
      const type = t < 0.6 ? 'treeTrunkSmall' : 'treeTrunkMedium';
      tryPlace(gx, gy, type, scene.treeTrunks);
    }
    // Enemies: occasional slime
    try { Enemies.spawnSlimeAtGrid(scene, 2 + Math.floor(rand() * (Wg - 4)), 2 + Math.floor(rand() * (Hg - 4)), { speed: 58 }); } catch {}
  }
}
