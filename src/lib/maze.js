/*
 AI-INDEX
 - Tags: world.maze, world.walls
 - See: docs/ai/index.json
*/

// Inlined helpers to avoid circular imports with world.js
function gridToWorld(scene, gx, gy) {
  const cs = scene.gridCellSize;
  return { x: gx * cs + cs / 2, y: gy * cs + cs / 2 };
}
function occupyGridCell(scene, gx, gy) {
  if (!scene.occupiedCells) scene.occupiedCells = new Set();
  scene.occupiedCells.add(`${gx},${gy}`);
}
function getEdgeEntranceCellsLocal(scene) {
  const cs = scene.gridCellSize;
  const maxGX = Math.floor(scene.worldPixelWidth / cs) - 1;
  const maxGY = Math.floor(scene.worldPixelHeight / cs) - 1;
  const mapDoors = scene.doorRegistry?.[scene.currentMap] || {};
  const mapType = scene.maps?.[scene.currentMap]?.type;
  const minHalf = (mapType === 'overworld') ? 1 : 0;
  const cells = new Set();
  for (const [, d] of Object.entries(mapDoors)) {
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

// Generate a sparse maze-like layout: use an odd-grid Prim carve to create corridors,
// then place a small number of wall tiles adjacent to corridors to form light obstacles.
export function generateMazeWalls(scene, opts = {}) {
  const cs = scene.gridCellSize;
  const W = scene.gridWidth;
  const H = scene.gridHeight;
  const isOverworld = scene.maps?.[scene.currentMap]?.type === 'overworld';
  if (!isOverworld) return;
  const biome = opts.biome || scene.biome || 'plains';

  if (!scene.mazeWalls) scene.mazeWalls = scene.add.group();
  else scene.mazeWalls.clear(true, true);
  // Group to render purely visual canopy sprites above the player (no collisions)
  if (!scene.mazeDecor) scene.mazeDecor = scene.add.group(); else scene.mazeDecor.clear(true, true);

  // If a maze layout for this map already exists, rebuild deterministically and return
  const mapKey = scene.currentMap;
  scene._mazeLayouts = scene._mazeLayouts || {};
  const cached = scene._mazeLayouts[mapKey];
  // Deterministic per-cell pseudo-random for style choice
  const mapIdSeed = (typeof mapKey === 'number') ? mapKey : String(mapKey).split('').reduce((a,c)=>a + c.charCodeAt(0), 0);
  const cellRand = (gx, gy) => {
    let x = (mapIdSeed * 374761393) ^ (gx * 668265263) ^ (gy * 2147483647);
    x = (x ^ (x >>> 13)) >>> 0;
    return (x % 1000) / 1000;
  };
  if (Array.isArray(cached) && cached.length > 0) {
    // Recompute blocked cells (edge entrances and building door bottoms) to filter legacy layouts
    const blocked = new Set();
    const keyK = (gx, gy) => `${gx},${gy}`;
    const edgeCells = getEdgeEntranceCellsLocal(scene);
    for (const k of edgeCells) {
      const [gx, gy] = k.split(',').map(Number);
      let dx = 0, dy = 0;
      if (gy === 0) dy = 1; else if (gy === H - 1) dy = -1; else if (gx === 0) dx = 1; else if (gx === W - 1) dx = -1;
      for (let step = 1; step <= 2; step++) {
        const ix = gx + dx * step; const iy = gy + dy * step;
        if (ix >= 1 && ix <= W - 2 && iy >= 1 && iy <= H - 2) blocked.add(keyK(ix, iy));
      }
    }
    // Block two tiles below building entrances (and 3-wide width) so maze never encroaches doors
    const doors = scene.doorRegistry?.[scene.currentMap] || {};
    for (const d of Object.values(doors)) {
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
    // Filter cached cells against blocked zones
    const filtered = cached.filter(([gx, gy]) => !blocked.has(keyK(gx, gy)));
    // Rebuild using cached coordinates; re-occupy grid cells
    const occ = new Set(scene.occupiedCells);
    const recordOcc = (gx, gy) => { if (!scene.occupiedCells) scene.occupiedCells = new Set(); scene.occupiedCells.add(`${gx},${gy}`); };
    const addWallDet = (gx, gy) => {
      const wp = gridToWorld(scene, gx, gy);
      const r = cellRand(gx, gy);
      let obj;
      const forestBias = (biome === 'forest') ? 0.25 : 0;
      const rv = r + forestBias; // nudge distribution toward tree trunks in forests
      if (rv < 0.45) {
        obj = scene.add.rectangle(wp.x, wp.y, cs, cs, 0x777777);
      } else if (rv < 0.75) {
        const radius = Math.floor(cs * 0.5);
        obj = scene.add.circle(wp.x, wp.y, radius, 0x2e8b57);
      } else {
        const tw = Math.max(cs, Math.floor(cs));
        obj = scene.add.rectangle(wp.x, wp.y, tw, cs, 0x6b3f2a);
        // Add a simple non-colliding canopy above trunk when in forest
        if (biome === 'forest') {
          const canopy = scene.add.circle(wp.x, wp.y - Math.floor(cs * 0.5), Math.floor(cs * 0.9), 0x2f6f31, 0.8);
          canopy.setDepth(3); // above player and enemies
          scene.mazeDecor.add(canopy);
          if (scene.worldLayer) scene.worldLayer.add(canopy);
        }
      }
      scene.physics.add.existing(obj);
      if (obj.body?.setImmovable) obj.body.setImmovable(true);
      // Enforce at least one full grid cell collision box, centered
      try { obj.body.setSize(cs, cs, true); } catch {}
      obj.setDepth(0);
      scene.mazeWalls.add(obj);
      if (scene.worldLayer) scene.worldLayer.add(obj);
      recordOcc(gx, gy);
    };
    for (const [gx, gy] of filtered) addWallDet(gx, gy);
    // Update cached layout to the filtered one so it remains compliant going forward
    scene._mazeLayouts[mapKey] = filtered.slice();
    scene.lastMazeStats = { wallsCount: filtered.length, carvedCount: 0, candidates: 0, target: filtered.length };
    return;
  }

  const occ = new Set(scene.occupiedCells);
  const occHas = (gx, gy) => occ.has(`${gx},${gy}`);

  const minGX = 1, maxGX = W - 2;
  const minGY = 1, maxGY = H - 2;
  if (maxGX <= minGX || maxGY <= minGY) return;

  const isInside = (gx, gy) => gx >= minGX && gx <= maxGX && gy >= minGY && gy <= maxGY;
  const key = (gx, gy) => `${gx},${gy}`;
  const fromKey = (k) => k.split(',').map(Number);

  // Odd-grid cells
  const isCell = (gx, gy) => (gx % 2 === 1) && (gy % 2 === 1);
  const snapCell = (gx, gy) => [Math.min(maxGX, Math.max(minGX, gx | 1)), Math.min(maxGY, Math.max(minGY, gy | 1))];

  const carved = new Set();
  const has = (gx, gy) => carved.has(key(gx, gy));
  const carve = (gx, gy) => carved.add(key(gx, gy));

  const edgeCells = getEdgeEntranceCellsLocal(scene);
  const seeds = [];
  for (const k of edgeCells) {
    const [gx, gy] = fromKey(k);
    let nx = gx, ny = gy;
    if (gy === 0) ny = gy + 1; else if (gy === H - 1) ny = gy - 1; else if (gx === 0) nx = gx + 1; else if (gx === W - 1) nx = gx - 1;
    if (isInside(nx, ny) && !occHas(nx, ny)) {
      carve(nx, ny); // make entrance interior obvious
      const [cx, cy] = snapCell(nx, ny);
      if (!occHas(cx, cy)) seeds.push([cx, cy]);
    }
  }
  if (seeds.length === 0) seeds.push(snapCell(Math.floor(W / 2), Math.floor(H / 2)));

  // Prim on cell graph (2-step neighbors)
  const frontier = [];
  const addEdges = (cx, cy) => {
    const dirs = [[2,0],[-2,0],[0,2],[0,-2]];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (!isInside(nx, ny) || !isCell(nx, ny) || occHas(nx, ny)) continue;
      frontier.push({ fx: cx, fy: cy, tx: nx, ty: ny });
    }
  };
  for (const [sx, sy] of seeds) { carve(sx, sy); addEdges(sx, sy); }
  while (frontier.length) {
    const i = (Math.random() * frontier.length) | 0;
    const e = frontier.splice(i, 1)[0];
    if (has(e.tx, e.ty)) continue;
    const mx = e.fx + Math.sign(e.tx - e.fx);
    const my = e.fy + Math.sign(e.ty - e.fy);
    if (occHas(mx, my) || occHas(e.tx, e.ty)) continue;
    carve(mx, my);
    carve(e.tx, e.ty);
    addEdges(e.tx, e.ty);
  }

  // Build sparse wall candidates: non-carved interior tiles adjacent to carved
  const candidates = [];
  const adj = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let gx = minGX; gx <= maxGX; gx++) {
    for (let gy = minGY; gy <= maxGY; gy++) {
      if (occHas(gx, gy)) continue;
      if (has(gx, gy)) continue;
      let touches = 0; for (const [dx, dy] of adj) if (has(gx + dx, gy + dy)) touches++;
      if (touches > 0) candidates.push({ gx, gy, touches });
    }
  }

  // Block cells just inside edge entrances so maze walls never obstruct doors
  const blocked = new Set();
  const blockedHas = (gx, gy) => blocked.has(key(gx, gy));
  for (const k of edgeCells) {
    const [gx, gy] = fromKey(k);
    let dx = 0, dy = 0;
    if (gy === 0) { dy = 1; }
    else if (gy === H - 1) { dy = -1; }
    else if (gx === 0) { dx = 1; }
    else if (gx === W - 1) { dx = -1; }
    // Mark the first two tiles inward from the entrance gap as blocked
    for (let step = 1; step <= 2; step++) {
      const ix = gx + dx * step;
      const iy = gy + dy * step;
      if (isInside(ix, iy)) blocked.add(key(ix, iy));
    }
  }
  // Also block two tiles below any building entrances (3-wide) to keep door approaches clear
  const doors = scene.doorRegistry?.[scene.currentMap] || {};
  for (const d of Object.values(doors)) {
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

  // Aim for light density
  const interiorArea = (maxGX - minGX + 1) * (maxGY - minGY + 1);
  const target = Math.max(24, Math.floor(interiorArea * 0.12));
  for (let i = candidates.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }

  const placedWallsSet = new Set();
  const placedWalls = [];
  const recordWall = (gx, gy) => { placedWallsSet.add(key(gx, gy)); placedWalls.push([gx, gy]); };
  const isWallAt = (gx, gy) => placedWallsSet.has(key(gx, gy));
  const inInteriorSafe = (gx, gy) => gx >= minGX + 2 && gx <= maxGX - 2 && gy >= minGY + 2 && gy <= maxGY - 2;
  const addWall = (gx, gy, styleR = null) => {
    const wp = gridToWorld(scene, gx, gy);
    // Choose a style: brick, bush, or tree-like trunk
    const rRaw = (typeof styleR === 'number') ? styleR : Math.random();
    const r = rRaw + ((biome === 'forest') ? 0.25 : 0); // forest bias toward trunks
    let obj;
    if (r < 0.5) {
      // Brick: light gray block
      obj = scene.add.rectangle(wp.x, wp.y, cs, cs, 0x777777);
    } else if (r < 0.8) {
      // Bush: green circle (visual), body will be one full tile
      const radius = Math.floor(cs * 0.5);
      obj = scene.add.circle(wp.x, wp.y, radius, 0x2e8b57);
    } else {
      // Tree-like: ensure at least one tile collision width
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
    // Force collision hitbox to at least 1x1 grid cell, centered on tile
    try { obj.body.setSize(cs, cs, true); } catch {}
    obj.setDepth(0);
    scene.mazeWalls.add(obj);
    if (scene.worldLayer) scene.worldLayer.add(obj);
    occupyGridCell(scene, gx, gy);
    recordWall(gx, gy);
  };
  // Connectivity helpers
  const touchesExisting = (cells) => {
    for (const [x,y] of cells) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (isWallAt(x+dx, y+dy)) return true;
      }
    }
    return false;
  };
  const hasOneTileCorridor = (cells) => {
    const willBeWall = (x,y) => isWallAt(x,y) || cells.some(([cx,cy]) => cx===x && cy===y);
    for (const [x,y] of cells) {
      if (willBeWall(x-2,y) && !willBeWall(x-1,y) && has(x-1,y)) return true;
      if (willBeWall(x+2,y) && !willBeWall(x+1,y) && has(x+1,y)) return true;
      if (willBeWall(x,y-2) && !willBeWall(x,y-1) && has(x,y-1)) return true;
      if (willBeWall(x,y+2) && !willBeWall(x,y+1) && has(x,y+1)) return true;
    }
    return false;
  };
  const hasBufferGapFromOthers = (cells) => {
    // Ensure at least 1 tile gap (Chebyshev 1) from other sections if we don't connect
    for (const [x,y] of cells) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (isWallAt(x+dx, y+dy)) return false;
      }
    }
    return true;
  };

  // Define small wall shapes (no singletons)
  const shapes = [
    [[0,0],[1,0],[2,0],[3,0]],        // 4 horizontal
    [[0,0],[0,1],[0,2]],              // 3 vertical
    [[0,0],[1,1]],                    // 2 diagonal down-right
    [[0,0],[-1,1]],                   // 2 diagonal down-left
    [[0,0],[1,0],[0,1]]               // small L
  ];

  let wallsCount = 0;
  let attempts = 0;
  for (const c of candidates) {
    if (wallsCount >= target) break;
    if (++attempts > candidates.length * 2) break;
    // choose a base shape and try rotated/flipped variants
    const base = shapes[(Math.random()*shapes.length)|0];
    const variants = [];
    const rots = [[1,0,0,1],[0,1,-1,0],[-1,0,0,-1],[0,-1,1,0]]; // rotations
    for (const [a,b,c2,d] of rots) {
      variants.push(base.map(([x,y]) => [a*x + b*y, c2*x + d*y]));
      variants.push(base.map(([x,y]) => [-a*x - b*y, -c2*x - d*y]));
    }
    let placed = false;
    for (const off of variants) {
      const cells = off.map(([dx,dy]) => [c.gx + dx, c.gy + dy]);
      // Validate
      let ok = true;
      for (const [x,y] of cells) {
        if (!isInside(x,y) || !inInteriorSafe(x,y) || occHas(x,y) || has(x,y) || blockedHas(x,y)) { ok = false; break; }
      }
      if (!ok) continue;
      const connects = touchesExisting(cells);
      if (!connects && !hasBufferGapFromOthers(cells)) continue; // enforce 1-tile gap between sections
      if (hasOneTileCorridor(cells)) continue; // keep corridors >= 2 wide
      for (const [x,y] of cells) addWall(x,y);
      wallsCount += cells.length;
      placed = true;
      break;
    }
    // Do not place singletons; if no shape fits, skip
  }

  // Fallback: ensure a small visible cluster if nothing got placed (or extremely few)
  if (wallsCount < 8) {
    const canPlaceWall = (gx, gy) => {
      if (!isInside(gx, gy) || !inInteriorSafe(gx, gy)) return false;
      if (occHas(gx, gy) || has(gx, gy) || blockedHas(gx, gy) || isWallAt(gx, gy)) return false;
      return true;
    };
    const cx = ((minGX + maxGX) / 2) | 0;
    const cy = ((minGY + maxGY) / 2) | 0;
    const fallbackOffsets = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2]];
    for (const [dx, dy] of fallbackOffsets) {
      const gx = cx + dx, gy = cy + dy;
      if (!isInside(gx, gy) || occHas(gx, gy) || has(gx, gy)) continue;
      if (!canPlaceWall(gx, gy)) continue;
      addWall(gx, gy);
      wallsCount++;
    }
  }

  // Cache this layout for the current map so it remains stable across re-entries
  scene._mazeLayouts[mapKey] = placedWalls.slice();
  scene.lastMazeStats = { wallsCount, carvedCount: carved.size, candidates: candidates.length, target };
}
