/*
 AI-INDEX
 - Tags: engine.rng
 - See: docs/ai/index.json
*/

export type RNG = () => number;

// Simple mulberry32 fallback; can be swapped to seedrandom later
export function mulberry32(seed: number): RNG {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rngFor(scene: any, namespace: string, mapId?: any): RNG {
  const worldSeed = (scene.worldSeed ?? 0) >>> 0;
  const mapSeed = (typeof mapId !== 'undefined' ? mapId : scene.currentMap);
  const mapNum = (typeof mapSeed === 'number') ? mapSeed : hashStr(String(mapSeed));
  const ns = hashStr(namespace);
  const mixed = (worldSeed ^ (mapNum + 0x9E3779B9) ^ ns) >>> 0;
  return mulberry32(mixed);
}

export const randInt = (rng: RNG, min: number, maxInclusive: number) => Math.floor(rng() * (maxInclusive - min + 1)) + min;
export const choice = <T>(rng: RNG, arr: T[]): T => arr[Math.floor(rng() * arr.length)];
