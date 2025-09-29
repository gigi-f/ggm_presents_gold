/*
 AI-INDEX
 - Tags: engine.scenes
 - See: docs/ai/index.json
*/

// Create a simple prospector sprite (procedural) and save as a texture
// Features: grey moustache, blue overalls, big brown hat
export function ensureProspectorTexture(scene: any, key = 'prospector'): string {
  if (scene.textures.exists(key)) return key;

  const w = 20, h = 24;
  const g = scene.add.graphics();
  g.clear();

  // Base (transparent background)
  // Draw boots (brown)
  g.fillStyle(0x8B4513, 1);
  g.fillRect(5, 20, 4, 3);
  g.fillRect(11, 20, 4, 3);

  // Legs (blue overalls)
  g.fillStyle(0x1e5bb8, 1);
  g.fillRect(5, 14, 4, 6);
  g.fillRect(11, 14, 4, 6);

  // Torso (blue overalls body)
  g.fillRect(4, 8, 12, 7);

  // Straps (lighter blue)
  g.fillStyle(0x3f7be0, 1);
  g.fillRect(5, 8, 2, 5);
  g.fillRect(13, 8, 2, 5);

  // Arms (skin)
  g.fillStyle(0xf2cc99, 1);
  g.fillRect(2, 9, 2, 5);
  g.fillRect(16, 9, 2, 5);

  // Head (skin)
  g.fillStyle(0xf2cc99, 1);
  g.fillRect(6, 3, 8, 6);

  // Moustache (grey)
  g.fillStyle(0x9aa0a6, 1);
  g.fillRect(7, 7, 6, 2);

  // Hat brim (dark brown) and crown
  g.fillStyle(0x5a3714, 1);
  g.fillRect(3, 2, 14, 2);     // brim
  g.fillRect(8, 0, 4, 2);      // crown

  // Optional: gold buckle on overalls
  g.fillStyle(0xffd700, 1);
  g.fillRect(9, 11, 2, 2);

  const rt = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h, add: false });
  rt.draw(g, 0, 0);
  rt.saveTexture(key);
  g.destroy();
  rt.destroy();
  return key;
}