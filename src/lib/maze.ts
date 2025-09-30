/*
 AI-INDEX
 - Tags: world.maze, world.walls
 - See: docs/ai/index.json
*/

import { rngFor } from './rng';

function gridToWorld(scene: any, gx: number, gy: number) {
  const cs = scene.gridCellSize;
  return { x: gx * cs + cs / 2, y: gy * cs + cs / 2 };
}
function occupyGridCell(scene: any, gx: number, gy: number) {
  if (!scene.occupiedCells) scene.occupiedCells = new Set<string>();
  scene.occupiedCells.add(`${gx},${gy}`);
}
function getEdgeEntranceCellsLocal(scene: any) {
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  const mapDoors = scene.doorRegistry?.[scene.currentMap] || {};
  const mapType = scene.maps?.[scene.currentMap]?.type;
  const minHalf = (mapType === 'overworld') ? 1 : 0;
  const cells = new Set<string>();
  for (const [, d] of Object.entries<any>(mapDoors)) {
    if (!d?.type) continue;
    const raw = Number.isFinite(d.entranceHalfWidth) ? Math.floor(d.entranceHalfWidth) : Math.floor(scene.edgeGapRadius ?? 0);
    const half = Math.max(minHalf, Math.max(0, raw));
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

export function generateMazeWalls(scene: any, opts: any = {}) {
  const cs = scene.gridCellSize;
  const W = scene.gridWidth;
  const H = scene.gridHeight;
  const isOverworld = scene.maps?.[scene.currentMap]?.type === 'overworld';
  if (!isOverworld) return;
  const biome = opts.biome || scene.biome || 'plains';
  // Central deterministic RNG for maze generation
  // Mix namespace with map id to keep layouts stable per save+map
  const rng = rngFor(scene, 'maze');

  if (!scene.mazeWalls) scene.mazeWalls = scene.add.group();
  else scene.mazeWalls.clear(true, true);
  if (!scene.mazeDecor) scene.mazeDecor = scene.add.group(); else scene.mazeDecor.clear(true, true);

  const mapKey = scene.currentMap;
  scene._mazeLayouts = scene._mazeLayouts || {};
  const cached = scene._mazeLayouts[mapKey];
  // Per-cell stable variation derived from rng and cell coordinates
  // We avoid Math.random and local hashes; this blends rng value with coordinates
  const baseR = rng();
  const cellRand = (gx: number, gy: number) => {
    // Cheap mix function to spread baseR with coordinates deterministically
    let x = Math.imul((gx + 0x9E37) ^ (gy + 0x79B9), 0x85EBCA6B) ^ Math.floor(baseR * 0xFFFFFFFF);
    x ^= (x >>> 13); x = Math.imul(x, 0xC2B2AE35);
    x ^= (x >>> 16);
    return ((x >>> 0) % 1000) / 1000;
  };
  if (Array.isArray(cached) && cached.length > 0) {
    const blocked = new Set<string>();
    const keyK = (gx: number, gy: number) => `${gx},${gy}`;
    const edgeCells = getEdgeEntranceCellsLocal(scene);
    for (const k of edgeCells) {
      const [gx, gy] = (k as string).split(',').map(Number);
      let dx = 0, dy = 0;
      if (gy === 0) dy = 1; else if (gy === H - 1) dy = -1; else if (gx === 0) dx = 1; else if (gx === W - 1) dx = -1;
      for (let step = 1; step <= 2; step++) {
        const ix = gx + dx * step; const iy = gy + dy * step;
        if (ix >= 1 && ix <= W - 2 && iy >= 1 && iy <= H - 2) blocked.add(keyK(ix, iy));
      }
    }
    const doors = scene.doorRegistry?.[scene.currentMap] || {};
    for (const d of Object.values<any>(doors)) {
      if (d?.type === 'building_entrance') {
        const gx = d.gridX, gy = d.gridY;
        for (let ix = gx - 1; ix <= gx + 1; ix++) {
          for (let dy = 1; dy <= 2; dy++) {
            const iy = gy + dy;
            if (ix >= 1 && ix <= W - 2 && iy >= 1 && iy <= H - 2) blocked.add(keyK(ix, iy));
          }
        }
      }
    }
    const filtered = cached.filter(([gx, gy]: [number, number]) => !blocked.has(keyK(gx, gy)));
    const recordOcc = (gx: number, gy: number) => { if (!scene.occupiedCells) scene.occupiedCells = new Set<string>(); scene.occupiedCells.add(`${gx},${gy}`); };
    const addWallDet = (gx: number, gy: number) => {
      const wp = gridToWorld(scene, gx, gy);
      const r = cellRand(gx, gy);
      let obj: any;
      const forestBias = (biome === 'forest') ? 0.25 : 0;
      const rv = r + forestBias;
      if (rv < 0.45) {
        obj = scene.add.rectangle(wp.x, wp.y, cs, cs, 0x777777);
      } else if (rv < 0.75) {
        const radius = Math.floor(cs * 0.5);
        obj = scene.add.circle(wp.x, wp.y, radius, 0x2e8b57);
      } else {
        const tw = Math.max(cs, Math.floor(cs));
        obj = scene.add.rectangle(wp.x, wp.y, tw, cs, 0x6b3f2a);
        if (biome === 'forest') {
          const canopy = scene.add.circle(wp.x, wp.y - Math.floor(cs * 0.5), Math.floor(cs * 0.9), 0x2f6f31, 0.8);
          canopy.setDepth(3);
          scene.mazeDecor.add(canopy);
          if (scene.worldLayer) scene.worldLayer.add(canopy);
        }
      }
      scene.physics.add.existing(obj);
      if (obj.body?.setImmovable) obj.body.setImmovable(true);
      try { obj.body.setSize(cs, cs, true); } catch {}
      obj.setDepth(0);
      scene.mazeWalls.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      recordOcc(gx, gy);
    };
    for (const [gx, gy] of filtered) addWallDet(gx, gy);
    scene._mazeLayouts[mapKey] = filtered.slice();
    scene.lastMazeStats = { wallsCount: filtered.length, carvedCount: 0, candidates: 0, target: filtered.length };
    return;
  }

  const occ = new Set(scene.occupiedCells);
  const occHas = (gx: number, gy: number) => occ.has(`${gx},${gy}`);

  const minGX = 1, maxGX = W - 2;
  const minGY = 1, maxGY = H - 2;
  if (maxGX <= minGX || maxGY <= minGY) return;

  const isInside = (gx: number, gy: number) => gx >= minGX && gx <= maxGX && gy >= minGY && gy <= maxGY;
  const key = (gx: number, gy: number) => `${gx},${gy}`;
  const fromKey = (k: string) => k.split(',').map(Number);

  const isCell = (gx: number, gy: number) => (gx % 2 === 1) && (gy % 2 === 1);
  const snapCell = (gx: number, gy: number) => [Math.min(maxGX, Math.max(minGX, gx | 1)), Math.min(maxGY, Math.max(minGY, gy | 1))] as [number, number];

  const carved = new Set<string>();
  const has = (gx: number, gy: number) => carved.has(key(gx, gy));
  const carve = (gx: number, gy: number) => carved.add(key(gx, gy));

  const edgeCells = getEdgeEntranceCellsLocal(scene);
  const seeds: Array<[number, number]> = [];
  for (const k of edgeCells) {
    const [gx, gy] = fromKey(k as string);
    let nx = gx, ny = gy;
    if (gy === 0) ny = gy + 1; else if (gy === H - 1) ny = gy - 1; else if (gx === 0) nx = gx + 1; else if (gx === W - 1) nx = gx - 1;
    if (isInside(nx, ny) && !occHas(nx, ny)) {
      carve(nx, ny);
      const [cx, cy] = snapCell(nx, ny);
      if (!occHas(cx, cy)) seeds.push([cx, cy]);
    }
  }
  if (seeds.length === 0) seeds.push(snapCell(Math.floor(W / 2), Math.floor(H / 2)) as [number, number]);

  const frontier: Array<{fx:number,fy:number,tx:number,ty:number}> = [];
  const addEdges = (cx: number, cy: number) => {
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]] as const;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (!isInside(nx, ny) || !isCell(nx, ny) || occHas(nx, ny)) continue;
      frontier.push({ fx: cx, fy: cy, tx: nx, ty: ny });
    }
  };
  for (const [sx, sy] of seeds) { carve(sx, sy); addEdges(sx, sy); }
  while (frontier.length) {
  const i = (rng() * frontier.length) | 0;
    const e = frontier.splice(i, 1)[0];
    if (has(e.tx, e.ty)) continue;
    const mx = e.fx + Math.sign(e.tx - e.fx);
    const my = e.fy + Math.sign(e.ty - e.fy);
    if (occHas(mx, my) || occHas(e.tx, e.ty)) continue;
    carve(mx, my); carve(e.tx, e.ty); addEdges(e.tx, e.ty);
  }

  const candidates: Array<{gx:number,gy:number,touches:number}> = [];
  const adj = [[1,0],[-1,0],[0,1],[0,-1]] as const;
  for (let gx = minGX; gx <= maxGX; gx++) {
    for (let gy = minGY; gy <= maxGY; gy++) {
      if (occHas(gx, gy)) continue;
      if (has(gx, gy)) continue;
      let touches = 0; for (const [dx, dy] of adj) if (has(gx + dx, gy + dy)) touches++;
      if (touches > 0) candidates.push({ gx, gy, touches });
    }
  }

  const blocked = new Set<string>();
  const blockedHas = (gx: number, gy: number) => blocked.has(key(gx, gy));
  for (const k of edgeCells) {
    const [gx, gy] = fromKey(k as string);
    let dx = 0, dy = 0;
    if (gy === 0) { dy = 1; }
    else if (gy === H - 1) { dy = -1; }
    else if (gx === 0) { dx = 1; }
    else if (gx === W - 1) { dx = -1; }
    for (let step = 1; step <= 2; step++) {
      const ix = gx + dx * step; const iy = gy + dy * step;
      if (isInside(ix, iy)) blocked.add(key(ix, iy));
    }
  }
  const doors = scene.doorRegistry?.[scene.currentMap] || {};
  for (const d of Object.values<any>(doors)) {
    if (d?.type === 'building_entrance') {
      const gx = d.gridX, gy = d.gridY;
      for (let ix = gx - 1; ix <= gx + 1; ix++) {
        for (let dy = 1; dy <= 2; dy++) {
          const iy = gy + dy;
          if (isInside(ix, iy)) blocked.add(key(ix, iy));
        }
      }
    }
  }

  const interiorArea = (maxGX - minGX + 1) * (maxGY - minGY + 1);
  const target = Math.max(24, Math.floor(interiorArea * 0.12));
  for (let i = candidates.length - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }

  const placedWallsSet = new Set<string>();
  const placedWalls: Array<[number, number]> = [];
  const recordWall = (gx: number, gy: number) => { placedWallsSet.add(key(gx, gy)); placedWalls.push([gx, gy]); };
  const isWallAt = (gx: number, gy: number) => placedWallsSet.has(key(gx, gy));
  const inInteriorSafe = (gx: number, gy: number) => gx >= minGX + 2 && gx <= maxGX - 2 && gy >= minGY + 2 && gy <= maxGY - 2;
  const addWall = (gx: number, gy: number, styleR: number | null = null) => {
    const wp = gridToWorld(scene, gx, gy);
  const rRaw = (typeof styleR === 'number') ? styleR : rng();
    const r = rRaw + ((biome === 'forest') ? 0.25 : 0);
    let obj: any;
    if (r < 0.5) {
      obj = scene.add.rectangle(wp.x, wp.y, cs, cs, 0x777777);
    } else if (r < 0.8) {
      const radius = Math.floor(cs * 0.5);
      obj = scene.add.circle(wp.x, wp.y, radius, 0x2e8b57);
    } else {
      const tw = Math.max(cs, Math.floor(cs));
      obj = scene.add.rectangle(wp.x, wp.y, tw, cs, 0x6b3f2a);
      if (biome === 'forest') {
        const canopy = scene.add.circle(wp.x, wp.y - Math.floor(cs * 0.5), Math.floor(cs * 0.9), 0x2f6f31, 0.8);
        canopy.setDepth(3);
        scene.mazeDecor.add(canopy);
        if (scene.worldLayer) scene.worldLayer.add(canopy);
      }
    }
    scene.physics.add.existing(obj);
    if (obj.body?.setImmovable) obj.body.setImmovable(true);
    try { obj.body.setSize(cs, cs, true); } catch {}
    obj.setDepth(0);
    scene.mazeWalls.add(obj);
    if (scene.worldLayer) scene.worldLayer.add(obj);
    occupyGridCell(scene, gx, gy);
    recordWall(gx, gy);
  };

  const touchesExisting = (cells: Array<[number, number]>) => {
    for (const [x,y] of cells) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (isWallAt(x+dx, y+dy)) return true;
      }
    }
    return false;
  };
  const hasOneTileCorridor = (cells: Array<[number, number]>) => {
    const willBeWall = (x:number,y:number) => isWallAt(x,y) || cells.some(([cx,cy]) => cx===x && cy===y);
    for (const [x,y] of cells) {
      if (willBeWall(x-2,y) && !willBeWall(x-1,y) && has(x-1,y)) return true;
      if (willBeWall(x+2,y) && !willBeWall(x+1,y) && has(x+1,y)) return true;
      if (willBeWall(x,y-2) && !willBeWall(x,y-1) && has(x,y-1)) return true;
      if (willBeWall(x,y+2) && !willBeWall(x,y+1) && has(x,y+1)) return true;
    }
    return false;
  };
  const hasBufferGapFromOthers = (cells: Array<[number, number]>) => {
    for (const [x,y] of cells) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (isWallAt(x+dx, y+dy)) return false;
      }
    }
    return true;
  };

  const shapes: Array<Array<[number, number]>> = [
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2]],
    [[0,0],[1,1]],
    [[0,0],[-1,1]],
    [[0,0],[1,0],[0,1]]
  ];

  let wallsCount = 0;
  let attempts = 0;
  for (const c of candidates) {
    if (wallsCount >= target) break;
    if (++attempts > candidates.length * 2) break;
  const base = shapes[(rng()*shapes.length)|0];
    const variants: Array<Array<[number, number]>> = [];
    const rots = [[1,0,0,1],[0,1,-1,0],[-1,0,0,-1],[0,-1,1,0]] as const;
    for (const [a,b,c2,d] of rots) {
      variants.push(base.map(([x,y]) => [a*x + b*y, c2*x + d*y] as [number, number]));
      variants.push(base.map(([x,y]) => [-a*x - b*y, -c2*x - d*y] as [number, number]));
    }
    for (const off of variants) {
      const cells = off.map(([dx,dy]) => [c.gx + dx, c.gy + dy] as [number, number]);
      let ok = true;
      for (const [x,y] of cells) {
        if (!isInside(x,y) || !inInteriorSafe(x,y) || occHas(x,y) || has(x,y) || blockedHas(x,y)) { ok = false; break; }
      }
      if (!ok) continue;
      const connects = touchesExisting(cells);
      if (!connects && !hasBufferGapFromOthers(cells)) continue;
      if (hasOneTileCorridor(cells)) continue;
      for (const [x,y] of cells) addWall(x,y);
      wallsCount += cells.length; break;
    }
  }

  if (wallsCount < 8) {
    const canPlaceWall = (gx: number, gy: number) => {
      if (!isInside(gx, gy) || !inInteriorSafe(gx, gy)) return false;
      if (occHas(gx, gy) || has(gx, gy) || blockedHas(gx, gy) || isWallAt(gx, gy)) return false;
      return true;
    };
    const cx = ((minGX + maxGX) / 2) | 0;
    const cy = ((minGY + maxGY) / 2) | 0;
    const fallbackOffsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2]] as const;
    for (const [dx, dy] of fallbackOffsets) {
      const gx = cx + dx, gy = cy + dy;
      if (!isInside(gx, gy) || occHas(gx, gy) || has(gx, gy)) continue;
      if (!canPlaceWall(gx, gy)) continue;
      addWall(gx, gy);
      wallsCount++;
    }
  }

  scene._mazeLayouts[mapKey] = placedWalls.slice();
  scene.lastMazeStats = { wallsCount, carvedCount: carved.size, candidates: candidates.length, target };
}
