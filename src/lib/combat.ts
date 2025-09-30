/*
 AI-INDEX
 - Tags: mechanics.combat
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import { damageEnemy } from './enemies';

export function swingMeleeWeapon(scene: any) {
  if (!scene.hasMeleeWeapon) { console.log('Cannot swing melee weapon - no weapon equipped!'); return; }
  if (scene.meleeWeaponSwinging) { console.log('Cannot swing melee weapon - already swinging!'); return; }
  if (scene.shieldRaised) { console.log('Cannot swing melee weapon - shield is raised! Lower shield first.'); return; }
  // Stamina gate
  if (typeof scene.stamina === 'number') {
    const cost = 15; // swing cost
    if (scene.stamina < cost) { console.log('Too exhausted to swing!'); return; }
    scene.stamina = Math.max(0, scene.stamina - cost);
    const ui = scene.scene.get('UIScene');
    if (ui && ui.updateStaminaBar) ui.updateStaminaBar(Math.round(scene.stamina), scene.maxStamina || 100);
  }
  scene.meleeWeaponSwinging = true;
  console.log(`Swinging ${scene.meleeWeaponName} in direction:`, scene.lastDirection);

  let weaponColor = 0xc0c0c0;
  let weaponSize = { width: 20, height: 4 };
  let swingDuration = 200;
  if (scene.equippedWeapon) {
    weaponColor = scene.equippedWeapon.color;
    weaponSize = scene.equippedWeapon.size;
    swingDuration = scene.equippedWeapon.swingDuration;
  } else {
    switch (scene.meleeWeaponType) {
      case 'basic': weaponColor = 0x888888; weaponSize = { width: 20, height: 4 }; swingDuration = 200; break;
      case 'strong': weaponColor = 0xFFD700; weaponSize = { width: 24, height: 5 }; swingDuration = 250; break;
      case 'fast': weaponColor = 0x00FFFF; weaponSize = { width: 16, height: 3 }; swingDuration = 150; break;
    }
  }

  if (!scene.meleeWeaponSprite) {
    // Create sprite anchored at inner edge (origin.x = 0) so it can pivot from the player's edge
    scene.meleeWeaponSprite = scene.add.rectangle(scene.player.x, scene.player.y, weaponSize.width, weaponSize.height, weaponColor);
    scene.meleeWeaponSprite.setOrigin(0, 0.5);
    scene.meleeWeaponSprite.setDepth(2);
  } else {
    scene.meleeWeaponSprite.setSize(weaponSize.width, weaponSize.height);
    scene.meleeWeaponSprite.setFillStyle(weaponColor);
  }

  scene.meleeWeaponSprite.setVisible(true);
  // Position the weapon's inner edge at the player's edge in the facing direction
  positionWeaponAtPlayerEdge(scene);

  let startAngle = -45, endAngle = 45;
  if (scene.lastDirection === 'left') { startAngle = -135; endAngle = -225; }
  else if (scene.lastDirection === 'up') { startAngle = -135; endAngle = -45; }
  else if (scene.lastDirection === 'down') { startAngle = 45; endAngle = 135; }

  scene.meleeWeaponSprite.setRotation(Phaser.Math.DegToRad(startAngle));
  scene.tweens.add({
    targets: scene.meleeWeaponSprite,
    rotation: Phaser.Math.DegToRad(endAngle),
    duration: swingDuration,
    ease: 'Power2',
    onUpdate: () => updateMeleeWeaponPosition(scene),
    onComplete: () => { scene.meleeWeaponSprite.setVisible(false); }
  });

  // Damage enemies within melee arc during the swing window
  const baseDamage = (() => {
    if (scene.equippedWeapon) {
      switch (scene.equippedWeapon.subtype) {
        case 'strong': return 10;
        case 'fast': return 6;
        case 'basic':
        default: return 8;
      }
    }
    // fallback by meleeWeaponType
    switch (scene.meleeWeaponType) {
      case 'strong': return 10;
      case 'fast': return 6;
      case 'basic':
      default: return 8;
    }
  })();

  // Quick overlap check with all enemies group
  if (scene.enemiesGroup) {
    const enemies: any[] = scene.enemiesGroup.getChildren?.() || [];
    enemies.forEach((enemy: any) => {
      if (!enemy?.active) return;
      const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, enemy.x, enemy.y);
      if (dist > 36) return; // rough melee reach
      // Simple frontal arc: check angle difference
      const dx = enemy.x - scene.player.x; const dy = enemy.y - scene.player.y;
      const enemyAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
      const dirAngle = (() => {
        switch (scene.lastDirection) {
          case 'left': return 180;
          case 'up': return -90;
          case 'down': return 90;
          default: return 0; // right
        }
      })();
      const diff = Phaser.Math.Angle.WrapDegrees(enemyAngle - dirAngle);
      if (Math.abs(diff) <= 60) {
        // Use current weapon sprite position as hit origin (approx.) for knockback direction
        const wx = scene.meleeWeaponSprite?.x ?? scene.player.x;
        const wy = scene.meleeWeaponSprite?.y ?? scene.player.y;
        const angle = scene.meleeWeaponSprite?.rotation ?? 0;
        const reach = weaponSize.width || 20;
        const hitX = wx + Math.cos(angle) * reach;
        const hitY = wy + Math.sin(angle) * reach;
        damageEnemy(scene, enemy, baseDamage, { source: 'melee', cooldownMs: 140, knockback: 140, stunMs: 160, hitX, hitY });
      }
    });
  }

  // If the player swung at the shopkeeper, the shopkeeper retaliates with a powerful shot
  try {
    const keep = scene.shopkeeper;
    if (keep && keep.active && scene.currentMap && String(scene.maps?.[scene.currentMap]?.type) === 'shop') {
      const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, keep.x, keep.y);
      if (dist <= 36) {
        const dx = keep.x - scene.player.x; const dy = keep.y - scene.player.y;
        const keepAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
        const dirAngle = (() => {
          switch (scene.lastDirection) {
            case 'left': return 180;
            case 'up': return -90;
            case 'down': return 90;
            default: return 0; // right
          }
        })();
        const diff = Phaser.Math.Angle.WrapDegrees(keepAngle - dirAngle);
        if (Math.abs(diff) <= 60) {
          // Rate-limit retaliation to once per short window
          const now = scene.time?.now ?? (globalThis as any).performance?.now?.() ?? Date.now();
          if (!scene._shopkeeperRetaliateUntil || now >= scene._shopkeeperRetaliateUntil) {
            scene._shopkeeperRetaliateUntil = now + 600; // 0.6s cooldown
            // Show the shotgun for a brief period and let the main update aim it at the player
            scene._shopkeeperGunVisibleUntil = Math.max(scene._shopkeeperGunVisibleUntil || 0, now + 6400);
            // Fire a fast projectile toward the player
            const bullet = scene.add.rectangle(keep.x, keep.y, 4, 4, 0xff3333).setDepth(3);
            if (scene.worldLayer) { try { scene.worldLayer.add(bullet); } catch {}
            }
            scene.physics.add.existing(bullet);
            const body = bullet.body;
            if (body) {
              body.setAllowGravity?.(false);
              body.setImmovable?.(false);
              const vx = scene.player.x - keep.x; const vy = scene.player.y - keep.y;
              const len = Math.hypot(vx, vy) || 1;
              const speed = 380;
              body.setVelocity((vx/len) * speed, (vy/len) * speed);
            }
            // On hit: massive damage
            const overlap = scene.physics.add.overlap(bullet, scene.player, () => {
              try { (overlap as any)?.destroy?.(); } catch {}
              try { (bullet as any)?.destroy?.(); } catch {}
              try { scene.takeDamage?.(500); } catch {}
            });
            // Auto-cleanup after 1.25s in case it misses
            scene.time.delayedCall(1250, () => { try { (overlap as any)?.destroy?.(); } catch {} try { (bullet as any)?.destroy?.(); } catch {} });
            // Optional feedback
            try { scene.showToast?.('You angered the shopkeeper!'); } catch {}
          }
        }
      }
    }
  } catch {}

  scene.time.delayedCall(300, () => { scene.meleeWeaponSwinging = false; });
}

export function updateMeleeWeaponPosition(scene: any) {
  if (!scene.meleeWeaponSprite || !scene.meleeWeaponSwinging) return;
  // Keep the inner edge anchored at the player's edge while swinging
  positionWeaponAtPlayerEdge(scene);
}

// Helper: compute facing vector and anchor the weapon's inner edge at the player's edge
function positionWeaponAtPlayerEdge(scene: any) {
  const player = scene.player;
  if (!player) return;
  const body = player.body || {};
  const halfW = ((body.width ?? player.displayWidth ?? 16) / 2) | 0;
  const halfH = ((body.height ?? player.displayHeight ?? 16) / 2) | 0;
  const gap = 2; // small separation so weapon doesn't overlap the sprite
  let nx = 1, ny = 0;
  switch (scene.lastDirection) {
    case 'left': nx = -1; ny = 0; break;
    case 'up': nx = 0; ny = -1; break;
    case 'down': nx = 0; ny = 1; break;
    default: nx = 1; ny = 0; // right
  }
  const offset = (nx !== 0) ? (halfW + gap) : (halfH + gap);
  const ax = player.x + nx * offset;
  const ay = player.y + ny * offset;
  scene.meleeWeaponSprite.setPosition(ax, ay);
}

export function raiseShield(scene: any) {
  if (!scene.hasShield) { console.log('Cannot raise shield - no shield equipped!'); return; }
  if (scene.meleeWeaponSwinging) { console.log('Cannot raise shield - currently swinging melee weapon!'); return; }
  scene.shieldRaised = true;
  let shieldColor = 0x654321; let shieldSize = { width: 12, height: 16 };
  if (scene.equippedShield) { shieldColor = scene.equippedShield.color; shieldSize = scene.equippedShield.size; }
  else {
    switch (scene.shieldType) {
      case 'basic': shieldColor = 0x654321; shieldSize = { width: 12, height: 16 }; break;
      case 'strong': shieldColor = 0xC0C0C0; shieldSize = { width: 14, height: 18 }; break;
      case 'light': shieldColor = 0x4169E1; shieldSize = { width: 10, height: 14 }; break;
    }
  }
  if (!scene.shieldSprite) {
    scene.shieldSprite = scene.add.rectangle(0, 0, shieldSize.width, shieldSize.height, shieldColor);
    scene.shieldSprite.setDepth(2); // ensure shield renders above player/world
    scene.physics.add.existing(scene.shieldSprite);
    scene.shieldSprite.body.setImmovable(true);
  } else {
    scene.shieldSprite.setSize(shieldSize.width, shieldSize.height);
    scene.shieldSprite.setFillStyle(shieldColor);
    scene.shieldSprite.body.setSize(shieldSize.width, shieldSize.height);
  }
  updateShieldPosition(scene);
  scene.shieldSprite.setVisible(true);
  // Add physical collision so shield can push enemies away
  try {
    if (scene.enemiesGroup && !scene._shieldEnemyCollider) {
      scene._shieldEnemyCollider = scene.physics.add.collider(scene.enemiesGroup, scene.shieldSprite, (enemy: any, shield: any) => {
        // Apply a small knockback to enemy away from the shield center
        try {
          const dx = enemy.x - shield.x; const dy = enemy.y - shield.y;
          const len = Math.hypot(dx, dy) || 1;
          const kb = 120;
          enemy.body?.setVelocity((dx/len) * kb, (dy/len) * kb);
          enemy.stunUntil = (scene.time?.now ?? 0) + 100;
        } catch {}
      });
    }
  } catch {}
  console.log('Shield raised - physical collider active.');
}

export function lowerShield(scene: any) {
  if (!scene.hasShield) { console.log('Cannot lower shield - no shield equipped!'); return; }
  scene.shieldRaised = false;
  if (scene.shieldSprite) { scene.shieldSprite.setVisible(false); scene.shieldSprite.body.enable = false; }
  // Remove shield-enemy collider so idle shield doesn't block when lowered
  try {
    if (scene._shieldEnemyCollider) { scene._shieldEnemyCollider.destroy(); scene._shieldEnemyCollider = null; }
  } catch {}
  console.log('Shield lowered - no longer blocking');
}

export function updateShieldPosition(scene: any) {
  if (!scene.shieldSprite || !scene.shieldRaised) return;
  scene.shieldSprite.body.enable = true;
  const offsetDistance = 15;
  switch (scene.lastDirection) {
    case 'left': scene.shieldSprite.x = scene.player.x - offsetDistance; scene.shieldSprite.y = scene.player.y; break;
    case 'right': scene.shieldSprite.x = scene.player.x + offsetDistance; scene.shieldSprite.y = scene.player.y; break;
    case 'up': scene.shieldSprite.x = scene.player.x; scene.shieldSprite.y = scene.player.y - offsetDistance; break;
    case 'down': scene.shieldSprite.x = scene.player.x; scene.shieldSprite.y = scene.player.y + offsetDistance; break;
    default: scene.shieldSprite.x = scene.player.x + offsetDistance; scene.shieldSprite.y = scene.player.y;
  }
}
