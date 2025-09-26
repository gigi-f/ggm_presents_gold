// Transition helpers for smooth overworld scrolling and input/physics locking
// This module is pure JS to avoid adding TS friction before Node deps are installed.

/** Begin a transition: lock input and physics */
export function beginTransition(scene) {
  scene.isScrolling = true;
  scene.transitionLock = true;
  if (scene.player && scene.player.body) {
    scene.player.body.setVelocity(0, 0);
    scene.player.body.enable = false;
  }
  if (scene.input && scene.input.keyboard) {
    scene.input.keyboard.enabled = false;
  }
}

/** End a transition: unlock and reset key states */
export function endTransition(scene) {
  if (scene.player && scene.player.body) {
    scene.player.body.enable = true;
    scene.player.body.setVelocity(0, 0);
  }
  scene.transitionLock = false;
  scene.isScrolling = false;
  if (scene.input && scene.input.keyboard) {
    scene.input.keyboard.enabled = true;
  }
  if (scene.keys) {
    for (const k of Object.values(scene.keys)) {
      if (k && typeof k.reset === 'function') k.reset();
      else if (k) { k.isDown = false; k.isUp = true; }
    }
  }
}

/**
 * Slide old map away and new map in, while tweening the player landing.
 * direction: 'left' | 'right' | 'up' | 'down'
 */
export function scrollTransitionToMap(scene, direction, newMapId, playerX, playerY) {
  if (scene.isScrolling) return;
  beginTransition(scene);

  // Freeze player during transition
  if (scene.player && scene.player.body) {
    scene.player.body.setVelocity(0, 0);
    scene.player.body.enable = false;
  }

  const oldLayer = scene.worldLayer;
  const newLayer = scene.add.container(0, 0);

  // Switch current map now
  const targetColor = scene.maps[newMapId].color;
  scene.currentMap = newMapId;
  scene.cameras.main.setBackgroundColor(targetColor);

  // Build new map into newLayer
  scene.worldLayer = newLayer;
  scene.createMapObjects({ preserveExistingWorld: true, buildIntoExistingWorldLayer: true });

  // Position layers
  let toX = 0, toY = 0;
  const W = scene.worldPixelWidth, H = scene.worldPixelHeight;
  if (direction === 'right') { newLayer.x = W; oldLayer.x = 0; toX = -W; }
  else if (direction === 'left') { newLayer.x = -W; oldLayer.x = 0; toX = W; }
  else if (direction === 'down') { newLayer.y = H; oldLayer.y = 0; toY = -H; }
  else if (direction === 'up') { newLayer.y = -H; oldLayer.y = 0; toY = H; }

  scene.tweens.add({ targets: newLayer, x: 0, y: 0, duration: 750, ease: 'Sine.easeInOut' });
  scene.tweens.add({
    targets: oldLayer,
    x: toX,
    y: toY,
    duration: 750,
    ease: 'Sine.easeInOut',
    onComplete: () => {
      oldLayer.destroy(true);
      newLayer.x = 0; newLayer.y = 0;
      scene.worldLayer = newLayer;
      endTransition(scene);
    }
  });

  if (scene.player) {
    scene.tweens.add({ targets: scene.player, x: playerX, y: playerY, duration: 750, ease: 'Sine.easeInOut' });
  }
}
