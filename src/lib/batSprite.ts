/*
 AI-INDEX
 - Tags: engine.sprites, mechanics.enemies
 - See: docs/ai/index.json
*/

// Create and cache a small pixel bat texture
export function ensureBatTexture(scene: any, key = 'bat'): string {
  if (scene.textures.exists(key)) return key;

  const w = 20, h = 12;
  const g = scene.add.graphics();
  g.clear();

  // Colors
  const bodyColor = 0x2b2b2b;
  const wingColor = 0x232323;
  const eyeColor = 0xffee66;

  // Wings (simple polygon shapes)
  g.fillStyle(wingColor, 1);
  g.beginPath();
  // Left wing
  g.moveTo(10, 6);
  g.lineTo(3, 2);
  g.lineTo(5, 6);
  g.lineTo(3, 10);
  g.closePath();
  g.fillPath();

  g.beginPath();
  // Right wing
  g.moveTo(10, 6);
  g.lineTo(17, 2);
  g.lineTo(15, 6);
  g.lineTo(17, 10);
  g.closePath();
  g.fillPath();

  // Body (ellipse) and head
  g.fillStyle(bodyColor, 1);
  g.fillEllipse(10, 7, 8, 6);
  g.fillEllipse(10, 4, 6, 4);

  // Ears
  g.beginPath();
  g.moveTo(8, 2);
  g.lineTo(9, 0);
  g.lineTo(10, 2);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(12, 2);
  g.lineTo(11, 0);
  g.lineTo(10, 2);
  g.closePath();
  g.fillPath();

  // Eyes
  g.fillStyle(eyeColor, 1);
  g.fillRect(8, 4, 1, 1);
  g.fillRect(11, 4, 1, 1);

  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false });
  rt.draw(g, 0, 0);
  rt.saveTexture(key);
  g.destroy();
  rt.destroy();
  return key;
}