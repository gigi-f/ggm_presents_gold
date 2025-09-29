/*
 AI-INDEX
 - Tags: mechanics.doors, engine.scenes
 - See: docs/ai/index.json
*/
// Transition helpers for smooth overworld scrolling and input/physics locking
// Keep types light to integrate with existing JS scenes
import { freezeEnemies } from './enemies';
import { getBiomeForMap } from './biomes';

export function beginTransition(scene: any) {
  scene.isScrolling = true;
  scene.transitionLock = true;
  if (scene.player && scene.player.body) {
    scene.player.body.setVelocity(0, 0);
    scene.player.body.enable = false;
  }
  freezeEnemies(scene, true);
  if (scene.input && scene.input.keyboard) {
    scene.input.keyboard.enabled = false;
  }
}

export function endTransition(scene: any) {
  if (scene.player && scene.player.body) {
    scene.player.body.enable = true;
    scene.player.body.setVelocity(0, 0);
  }
  scene.transitionLock = false;
  scene.isScrolling = false;
  freezeEnemies(scene, false);
  if (scene.input && scene.input.keyboard) {
    scene.input.keyboard.enabled = true;
  }
  if (scene.keys) {
    for (const k of Object.values(scene.keys)) {
      if (k && typeof (k as any).reset === 'function') (k as any).reset();
      else if (k) { (k as any).isDown = false; (k as any).isUp = true; }
    }
  }
}

/**
 * Slide old map away and new map in, while tweening the player landing.
 * direction: 'left' | 'right' | 'up' | 'down'
 */
export function scrollTransitionToMap(scene: any, direction: 'left'|'right'|'up'|'down', newMapId: any, playerX: number, playerY: number) {
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
  // Update biome HUD immediately
  try { scene.scene.get('UIScene')?.updateBiome?.(getBiomeForMap(scene, scene.currentMap)); } catch {}

  // Build new map into newLayer; preserve enemies so persistent ones can be rehomed
  scene.worldLayer = newLayer;
  scene.createMapObjects({ preserveExistingWorld: true, buildIntoExistingWorldLayer: true, preserveEnemies: true });

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
      if (scene.enemiesGroup) {
        for (const enemy of scene.enemiesGroup.getChildren()) {
          if (!enemy.active) continue;
          const inOldLayer = (enemy as any).parentContainer === oldLayer;
          if (!inOldLayer) continue;
          if ((enemy as any).persistentAcrossMaps) {
            try { newLayer.add(enemy); } catch {}
          } else {
            try { enemy.destroy(); } catch {}
          }
        }
      }
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