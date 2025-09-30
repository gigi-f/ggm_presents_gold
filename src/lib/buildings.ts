/*
 AI-INDEX
 - Tags: mechanics.buildings
 - See: docs/ai/index.json
*/

// Procedural building generator: creates a composite building around a door grid position
// Uses primitive shapes (rectangles, graphics, text) and adds collision walls to scene.buildingWalls

// Lightweight deterministic RNG (mulberry32) and a simple string hash to seed it
function hashString(str: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rngChoice<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function rngRangeInt(rng: () => number, min: number, maxInclusive: number) { return Math.floor(rng() * (maxInclusive - min + 1)) + min; }

// Basic style catalog (can be expanded/per-biome)
const STYLES: any = {
  shop: {
    signText: 'SHOP',
    wallPalette: [0x8B6D5C, 0x9C7A6C, 0x7A5C41, 0x6E5A48],
    roofPalette: [0xB84E44, 0x8F3E78, 0x3C6E71, 0x6B8E23],
    trimPalette: [0xE0D5C6, 0xD9C8B4, 0xC9B79C],
    signColor: 0x654321,
    signTextColor: 0xFFFFFF
  },
  house: {
    signText: '',
    wallPalette: [0xBCA18E, 0xA38469, 0x9D7D57],
    roofPalette: [0x7B3F00, 0x704214, 0x6B4423],
    trimPalette: [0xF0E8DA, 0xE8DECF, 0xE2D6C7],
    signColor: 0x000000,
    signTextColor: 0xFFFFFF
  },
  armory: {
    signText: 'ARMOR',
    wallPalette: [0x6D6D6D, 0x7A7A7A, 0x5E5E5E],
    roofPalette: [0x3A3A3A, 0x2E2E2E, 0x444444],
    trimPalette: [0xC0C0C0, 0xB0B0B0, 0xD0D0D0],
    signColor: 0x333333,
    signTextColor: 0xFFFFFF
  }
};

export function createShopBuilding(scene: any, doorGridX: number, doorGridY: number, opts: any = {}) {
  const cs = scene.gridCellSize;
  const gridW = scene.gridWidth;
  const gridH = scene.gridHeight;

  // Deterministic RNG from seed (map + door) unless overridden
  const defaultSeedStr = `${scene.currentMap}:${doorGridX},${doorGridY}`;
  const seed = (typeof opts.seed === 'number') ? opts.seed : hashString(String(opts.seed ?? defaultSeedStr));
  const rng = mulberry32(seed);

  const bType = (opts.type && STYLES[opts.type]) ? opts.type : 'shop';
  const style = STYLES[bType];

  // Randomize footprint and style
  const widthTiles = opts.widthTiles ?? rngChoice(rng, [5, 6, 7]);
  let heightTiles = opts.heightTiles ?? rngChoice(rng, [4, 5]);
  const wallColor = opts.wallColor ?? rngChoice(rng, style.wallPalette);
  const roofColor = opts.roofColor ?? rngChoice(rng, style.roofPalette);
  const trimColor = opts.trimColor ?? rngChoice(rng, style.trimPalette);
  const signColor = opts.signColor ?? style.signColor;
  // Roofs are disabled for now; leave code behind a flag in case we want to re-enable later
  const ENABLE_ROOF = opts.enableRoof ?? false;
  const roofStyle = opts.roofStyle ?? rngChoice(rng, ['flat', 'gabled']);
  const addChimney = ENABLE_ROOF ? (opts.addChimney ?? (rng() < 0.5)) : false;
  const windowCols = opts.windowCols ?? rngRangeInt(rng, 1, 3);
  const windowRows = opts.windowRows ?? Math.max(1, heightTiles - 2);
  const trimStroke = opts.trimStroke ?? rngRangeInt(rng, 1, 2);

  // Position footprint so the door is centered on bottom side
  let leftGX = doorGridX - Math.floor(widthTiles / 2);
  let desiredTopGY = doorGridY - (heightTiles - 1);
  // Keep at least one full grid cell of empty space between building and boundary walls
  const minGX = 2;
  const maxGX = gridW - widthTiles - 2; // 1-cell gap at right side
  const minGY = 2;
  const maxGY = gridH - heightTiles - 2; // 1-cell gap at bottom
  // Compute allowable height range to maintain 1-tile margins while keeping the bottom aligned with the door
  const maxHeightFromDoor = Math.max(2, doorGridY - minGY + 1);
  const minHeightFromDoor = Math.max(2, doorGridY - maxGY + 1);
  if (heightTiles > maxHeightFromDoor) heightTiles = maxHeightFromDoor;
  if (heightTiles < minHeightFromDoor) heightTiles = minHeightFromDoor;
  desiredTopGY = doorGridY - (heightTiles - 1);
  // Clamp within margins horizontally; vertically try to preserve bottom alignment
  leftGX = Math.max(minGX, Math.min(leftGX, maxGX));
  let topGY = desiredTopGY;
  if (topGY < minGY) topGY = minGY;
  if (topGY > maxGY) topGY = maxGY;

  const bodyW = widthTiles * cs;
  const bodyH = heightTiles * cs;
  const worldX = leftGX * cs + bodyW / 2;
  const worldY = (topGY * cs) + bodyH / 2;

  // Create a container for the building visuals
  const building = scene.add.container(worldX, worldY);
  building.setDepth(0);
  if (scene.worldLayer) scene.worldLayer.add(building);

  // Body (visual only) - aligned to full grid dimensions
  const bodyRect = scene.add.rectangle(0, 0, bodyW, bodyH, wallColor);
  bodyRect.setStrokeStyle(trimStroke, trimColor, 1);
  building.add(bodyRect);

  // Vertical layout zones
  const roofBaseY = -bodyH / 2; // top of body
  let facadeTopY = roofBaseY + cs * 0.5;
  const roofH = Math.max(cs, Math.floor(cs));
  if (ENABLE_ROOF) {
    const roofOverhang = cs * 0.5;
    const roofH = Math.max(cs, Math.floor(cs));
    facadeTopY = roofBaseY + (roofStyle === 'flat' ? roofH : cs);
    if (roofStyle === 'flat') {
      const roofRect = scene.add.rectangle(0, roofBaseY + roofH / 2, bodyW + roofOverhang, roofH, roofColor);
      roofRect.setStrokeStyle(trimStroke, trimColor, 1);
      building.add(roofRect);
      const g = scene.add.graphics();
      g.lineStyle(1, 0x000000, 0.12);
      const shingles = Math.max(3, Math.floor(roofH / 3));
      for (let i = 1; i < shingles; i++) {
        const y = roofBaseY + (i * (roofH / shingles));
        g.beginPath(); g.moveTo(- (bodyW + roofOverhang) / 2 + 2, y); g.lineTo((bodyW + roofOverhang) / 2 - 2, y); g.strokePath();
      }
      building.add(g);
    } else {
      const g = scene.add.graphics();
      g.fillStyle(roofColor, 1);
      const baseY = roofBaseY + trimStroke;
      const topY = baseY - cs;
      const halfW = (bodyW + roofOverhang) / 2;
      g.beginPath(); g.moveTo(-halfW, baseY); g.lineTo(halfW, baseY); g.lineTo(0, topY); g.closePath(); g.fillPath();
      g.lineStyle(trimStroke, trimColor, 1);
      g.beginPath(); g.moveTo(-halfW, baseY); g.lineTo(halfW, baseY); g.lineTo(0, topY); g.lineTo(-halfW, baseY); g.strokePath();
      building.add(g);
    }
  }

  // Optional chimney
  if (ENABLE_ROOF && addChimney) {
    const chimW = Math.floor(cs * 0.5);
    const chimH = Math.floor(cs * 0.9);
    const side = (rng() < 0.5) ? -1 : 1; // left/right
    const cx = side * (bodyW * 0.25);
    const baseY = roofBaseY + trimStroke;
    const cy = (roofStyle === 'flat')
      ? (roofBaseY + (roofH / 2) - chimH / 2)
      : (baseY - cs * 0.5 + chimH / 2);
    const chimney = scene.add.rectangle(cx, cy, chimW, chimH, 0x4a3b2f);
    chimney.setStrokeStyle(1, trimColor, 1);
    building.add(chimney);
  }

  // Compute a safe sign band above the door and below the facade/roof zone
  const doorTopY = bodyH / 2 - (2 * cs);
  const signHalfH = (cs * 0.7) / 2;
  const signClearance = cs * 0.75;
  let signBandY = doorTopY - signClearance - signHalfH;
  const minSignY = facadeTopY + cs * 0.8;
  if (signBandY < minSignY) signBandY = minSignY;

  // Windows (2 columns x N rows)
  const windowW = cs * 0.6;
  const windowH = cs * 0.6;
  const xOffsets: number[] = [];
  if (windowCols === 1) xOffsets.push(0);
  if (windowCols === 2) xOffsets.push(-cs * 0.9, cs * 0.9);
  if (windowCols === 3) xOffsets.push(-cs * 1.2, 0, cs * 1.2);
  const winMargin = cs * 0.3;
  let rowY = facadeTopY + cs * 0.6;
  for (let r = 0; r < windowRows; r++) {
    if (rowY + windowH / 2 > signBandY - winMargin) break;
    for (let i = 0; i < xOffsets.length; i++) {
      const wx = xOffsets[i]; const wy = rowY;
      const wRect = scene.add.rectangle(wx, wy, windowW, windowH, 0xCFE8FF);
      wRect.setStrokeStyle(1, trimColor, 1);
      building.add(wRect);
    }
    rowY += (cs + 2);
  }

  // Sign above the door
  const signText = (typeof opts.signText === 'string') ? opts.signText : style.signText;
  if (signText) {
    const signY = signBandY;
    const signW = Math.min(bodyW * 0.75, cs * 2.2);
    const signH = cs * 0.7;
    const sign = scene.add.rectangle(0, signY, signW, signH, signColor);
    sign.setStrokeStyle(1, trimColor, 1);
    building.add(sign);
    const label = scene.add.text(0, signY, signText, { fontSize: '8px', color: '#FFFFFF' });
    label.setOrigin(0.5);
    building.add(label);
  }

  // Collision walls: perimeter excluding door gap at bottom middle
  if (!scene.buildingWalls) scene.buildingWalls = scene.add.group();
  const addWall = (gx: number, gy: number, w: number, h: number) => {
    const x = gx * cs + w / 2; const y = gy * cs + h / 2;
    const rect = scene.add.rectangle(x, y, w, h, 0x000000, 0);
    scene.physics.add.existing(rect);
    rect.body.setImmovable(true);
    rect.setDepth(0);
    scene.buildingWalls.add(rect);
    if (scene.worldLayer) scene.worldLayer.add(rect);
    return rect;
  };

  // Top wall row
  addWall(leftGX, topGY, bodyW, cs);

  // Side walls
  for (let gy = topGY + 1; gy < topGY + heightTiles; gy++) {
    addWall(leftGX, gy, cs, cs);
    addWall(leftGX + widthTiles - 1, gy, cs, cs);
  }

  // Bottom wall row with door gap
  for (let gx = leftGX; gx < leftGX + widthTiles; gx++) {
    const isDoorRow = (topGY + heightTiles - 1) === doorGridY;
    if (gx === doorGridX && isDoorRow) continue;
    if (isDoorRow && (gx === doorGridX - 1 || gx === doorGridX + 1)) {
      const clearance = 6;
      const w = Math.max(4, cs - clearance * 2);
      const rect = addWall(gx, topGY + heightTiles - 1, w, cs);
      if (gx === doorGridX - 1) rect.x = gx * cs + (cs - clearance) - (w / 2);
      else rect.x = gx * cs + clearance + (w / 2);
      continue;
    }
    addWall(gx, topGY + heightTiles - 1, cs, cs);
  }

  // Occupy footprint cells (prevents other objects) except door gap
  for (let gx = leftGX; gx < leftGX + widthTiles; gx++) {
    for (let gy = topGY; gy < topGY + heightTiles; gy++) {
      if (gx === doorGridX && gy === doorGridY) continue;
      const key = `${gx},${gy}`;
      scene.occupiedCells.add(key);
    }
  }

  return building;
}
