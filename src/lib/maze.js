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

  if (!scene.mazeWalls) scene.mazeWalls = scene.add.group();
  else scene.mazeWalls.clear(true, true);

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

  // Aim for light density
  const interiorArea = (maxGX - minGX + 1) * (maxGY - minGY + 1);
  const target = Math.max(24, Math.floor(interiorArea * 0.12));
  for (let i = candidates.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }

  const placedWallsSet = new Set();
  const placedWalls = [];
  const recordWall = (gx, gy) => { placedWallsSet.add(key(gx, gy)); placedWalls.push([gx, gy]); };
  const isWallAt = (gx, gy) => placedWallsSet.has(key(gx, gy));
  const inInteriorSafe = (gx, gy) => gx >= minGX + 2 && gx <= maxGX - 2 && gy >= minGY + 2 && gy <= maxGY - 2;
  const addWall = (gx, gy) => {
    const wp = gridToWorld(scene, gx, gy);
    // Choose a style: brick, bush, or tree-like trunk
    const r = Math.random();
    let obj;
    if (r < 0.5) {
      // Brick: light gray block
      obj = scene.add.rectangle(wp.x, wp.y, cs, cs, 0x777777);
    } else if (r < 0.8) {
      // Bush: green circle (still blocks like a tile via body bounds)
      const radius = Math.floor(cs * 0.45);
      obj = scene.add.circle(wp.x, wp.y, radius, 0x2e8b57);
    } else {
      // Tree-like: brown narrow vertical block centered in tile
      const tw = Math.max(6, Math.floor(cs * 0.55));
      obj = scene.add.rectangle(wp.x, wp.y, tw, cs, 0x6b3f2a);
    }
    scene.physics.add.existing(obj);
    if (obj.body?.setImmovable) obj.body.setImmovable(true);
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

  scene.lastMazeStats = { wallsCount, carvedCount: carved.size, candidates: candidates.length, target };
}
