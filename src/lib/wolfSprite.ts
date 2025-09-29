/*
 AI-INDEX
 - Tags: engine.sprites, mechanics.enemies
 - See: docs/ai/index.json
*/

// Create and cache a small pixel wolf texture
export function ensureWolfTexture(scene: any, key = 'wolf'): string {
  // If the texture is already available (preloaded image), use it directly
  if (scene.textures.exists(key)) return key;
  // If the loader has the image by the same key, it will be added automatically on scene start
  // but in case it's not, attempt to fall back to a procedural texture
  try {
    if (scene.textures.exists('wolf')) return 'wolf';
  } catch {}

  // Procedural fallback: generate a simple wolf if asset missing
  const w = 28, h = 16;
  const g = scene.add.graphics();
  g.clear();

  // Brown wolf palette
  const fur = 0x8b5a2b;
  const dark = 0x5a3b2e;
  const eye = 0xffe070;
  const nose = 0x222222;

  g.fillStyle(fur, 1);
  g.fillEllipse(12, 9, 14, 8);
  g.fillStyle(dark, 1);
  g.fillEllipse(13, 8, 12, 5);
  g.fillStyle(fur, 1);
  g.fillEllipse(20, 8, 8, 6);
  g.beginPath(); g.moveTo(18.5, 3); g.lineTo(19.5, 1); g.lineTo(20.5, 3); g.closePath(); g.fillPath();
  g.beginPath(); g.moveTo(21.5, 3); g.lineTo(22.5, 1); g.lineTo(23, 3.3); g.closePath(); g.fillPath();
  g.fillStyle(dark, 1);
  g.beginPath(); g.moveTo(5, 9); g.lineTo(1, 6); g.lineTo(2, 12); g.closePath(); g.fillPath();
  g.fillEllipse(7, 9, 6, 4);
  g.fillStyle(dark, 1);
  g.fillRect(8, 12, 2, 2); g.fillRect(14, 12, 2, 2);
  g.fillStyle(eye, 1); g.fillRect(21, 7, 1, 1);
  g.fillStyle(fur, 1); g.fillRect(22, 8, 3, 2);
  g.fillStyle(nose, 1); g.fillRect(25, 9, 1, 1);

  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false });
  rt.draw(g, 0, 0); rt.saveTexture(key);
  g.destroy(); rt.destroy();
  return key;
}