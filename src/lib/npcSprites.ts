/*
 AI-INDEX
 - Tags: graphics.npc, npc.shopkeeper
 - Purpose: Procedural NPC sprite generation for shopkeepers with simple variation
*/

export interface ShopkeeperOptions {
  seed?: string | number;
  heightPx?: number;            // final texture height (default 18..26)
  widthPx?: number;             // final texture width (default 12)
  clothesColor?: number;        // 0xRRGGBB
  skinColor?: number;           // 0xRRGGBB
  outlineColor?: number;        // 0xRRGGBB
  hat?: boolean;
}

export interface ShopkeeperSprite {
  npcType: string;
  npcSeed: string | number;
  npcConfig: {
    widthPx: number;
    heightPx: number;
    clothes: number;
    skin: number;
    outline: number;
    hat: boolean;
  };
  body?: any;
  setOrigin: (x: number, y: number) => void;
  setDepth: (depth: number) => void;
}

/** Simple string hash -> 32-bit int */
function hash32(str: string | number): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG from 32-bit seed */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function (): number {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick a value from an array using rng() in [0,1) */
function pick<T>(rng: () => number, arr: T[]): T { 
  return arr[Math.floor(rng() * arr.length)]; 
}

/**
 * Create a procedural shopkeeper sprite texture and return a Phaser.GameObjects.Sprite.
 * The sprite is bottom-origin (0.5, 1) to sit nicely on the grid.
 */
export function createShopkeeperSprite(scene: any, x: number, y: number, opts: ShopkeeperOptions = {}): ShopkeeperSprite {
  const seed = opts.seed ?? (Date.now() + ':' + Math.random());
  const rng = mulberry32(hash32(seed));

  // Defaults and gentle variation
  const heightPx = Math.round(opts.heightPx ?? (18 + Math.floor(rng() * 9))); // 18..26
  const widthPx = Math.round(opts.widthPx ?? 12);

  const clothesPalette = [0x7B3F00, 0xAA7733, 0x2E86AB, 0x8E44AD, 0x2ECC71, 0xC0392B, 0xB8860B, 0x556B2F];
  const skinPalette = [0xF1C27D, 0xE0AC69, 0xC68642, 0x8D5524];
  const outline = opts.outlineColor ?? 0x222222;
  const clothes = opts.clothesColor ?? pick(rng, clothesPalette);
  const skin = opts.skinColor ?? pick(rng, skinPalette);
  const hat = opts.hat ?? (rng() < 0.35);

  const g = scene.add.graphics();
  g.clear();
  g.lineStyle(1, outline, 1);

  // Compute simple body layout
  const headH = Math.round(heightPx * 0.35);
  const bodyH = Math.max(6, heightPx - headH - 2);
  const headR = Math.max(3, Math.round(Math.min(widthPx, headH) / 2.2));

  // Draw body (torso/robe)
  g.fillStyle(clothes, 1);
  g.fillRoundedRect(1, heightPx - bodyH, widthPx - 2, bodyH, 3);
  g.strokeRoundedRect(1, heightPx - bodyH, widthPx - 2, bodyH, 3);

  // Draw head
  g.fillStyle(skin, 1);
  const headCX = Math.round(widthPx / 2);
  const headCY = Math.round(heightPx - bodyH - headR);
  g.fillCircle(headCX, headCY, headR);
  g.strokeCircle(headCX, headCY, headR);

  // Optional hat (simple rectangle + brim)
  if (hat) {
    const hatH = Math.max(2, Math.round(headR * 0.7));
    const hatW = Math.max(6, Math.round(widthPx * 0.8));
    const hatX = Math.round((widthPx - hatW) / 2);
    const hatY = Math.max(1, headCY - headR - hatH + 2);
    const hatColor = clothes; // match clothes for cohesion
    g.fillStyle(hatColor, 1);
    g.fillRect(hatX, hatY, hatW, hatH);
    g.lineStyle(1, outline, 1);
    g.strokeRect(hatX, hatY, hatW, hatH);
    // Brim
    const brimY = hatY + hatH;
    g.fillRect(Math.max(0, hatX - 2), brimY, Math.min(widthPx, hatW + 4), 2);
  }

  // Generate a texture key unique to this seed + dim combo
  const key = `npc_shopkeeper_${widthPx}x${heightPx}_${hash32(seed)}`;
  g.generateTexture(key, widthPx, heightPx);
  g.destroy();

  // Create sprite
  const sprite = scene.add.sprite(x, y, key) as ShopkeeperSprite;
  sprite.setOrigin(0.5, 1);
  sprite.setDepth(1);
  sprite.npcType = 'shopkeeper';
  sprite.npcSeed = seed;
  sprite.npcConfig = { widthPx, heightPx, clothes, skin, outline, hat };

  // Physics body sized to body/robe area
  scene.physics.add.existing(sprite);
  if (sprite.body?.setImmovable) sprite.body.setImmovable(true);
  const bodyHpx = Math.max(8, Math.round(bodyH * 0.9));
  const bodyWpx = Math.max(6, Math.round((widthPx - 2) * 0.9));
  if (sprite.body?.setSize) sprite.body.setSize(bodyWpx, bodyHpx);
  if (sprite.body?.setOffset) sprite.body.setOffset(Math.round((widthPx - bodyWpx) / 2), heightPx - bodyHpx);

  return sprite;
}