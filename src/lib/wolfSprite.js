/*
 AI-INDEX
 - Tags: engine.sprites, mechanics.enemies
 - See: docs/ai/index.json
*/

// Create and cache a small pixel wolf texture
export function ensureWolfTexture(scene, key = 'wolf') {
  if (scene.textures.exists(key)) return key;

  // Base texture slightly wider so upscaling to 2 tiles preserves proportions
  const w = 28, h = 16;
  const g = scene.add.graphics();
  g.clear();

  // Brown wolf palette
  const fur = 0x8b5a2b;   // mid brown
  const dark = 0x5a3b2e;  // darker brown for shading/tail/legs
  const eye = 0xffe070;
  const nose = 0x222222;

  // Body
  g.fillStyle(fur, 1);
  g.fillEllipse(12, 9, 14, 8);
  // Back/neck shading
  g.fillStyle(dark, 1);
  g.fillEllipse(13, 8, 12, 5);

  // Head
  g.fillStyle(fur, 1);
  // Slightly wider head to support a longer snout
  g.fillEllipse(20, 8, 8, 6);

  // Ears
  g.beginPath();
  g.moveTo(18.5, 3); g.lineTo(19.5, 1); g.lineTo(20.5, 3); g.closePath(); g.fillPath();
  g.beginPath();
  g.moveTo(21.5, 3); g.lineTo(22.5, 1); g.lineTo(23, 3.3); g.closePath(); g.fillPath();

  // Tail (thicker)
  g.fillStyle(dark, 1);
  // Wider triangular sweep toward the back
  g.beginPath();
  g.moveTo(5, 9);
  g.lineTo(1, 6);
  g.lineTo(2, 12);
  g.closePath();
  g.fillPath();
  // Thicken tail base near body
  g.fillEllipse(7, 9, 6, 4);

  // Legs (subtle)
  g.fillStyle(dark, 1);
  g.fillRect(8, 12, 2, 2);
  g.fillRect(14, 12, 2, 2);

  // Eye and snout/nose
  g.fillStyle(eye, 1);
  g.fillRect(21, 7, 1, 1);
  // Extend snout forward
  g.fillStyle(fur, 1);
  g.fillRect(22, 8, 3, 2);
  // Nose at the tip
  g.fillStyle(nose, 1);
  g.fillRect(25, 9, 1, 1);

  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false });
  rt.draw(g, 0, 0);
  rt.saveTexture(key);
  g.destroy();
  rt.destroy();
  return key;
}
