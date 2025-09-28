/*
 AI-INDEX
 - Tags: mechanics.combat
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import { damageEnemy } from './enemies';
export function swingMeleeWeapon(scene) {
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
    scene.meleeWeaponSprite = scene.add.rectangle(scene.player.x, scene.player.y - 15, weaponSize.width, weaponSize.height, weaponColor);
    scene.meleeWeaponSprite.setOrigin(0, 0.5);
    scene.meleeWeaponSprite.setDepth(2);
  } else {
    scene.meleeWeaponSprite.setSize(weaponSize.width, weaponSize.height);
    scene.meleeWeaponSprite.setFillStyle(weaponColor);
  }

  scene.meleeWeaponSprite.setVisible(true);
  scene.meleeWeaponSprite.x = scene.player.x;
  scene.meleeWeaponSprite.y = scene.player.y;

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
    const enemies = scene.enemiesGroup.getChildren();
    enemies.forEach(enemy => {
      if (!enemy.active) return;
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
        damageEnemy(scene, enemy, baseDamage, { source: 'melee', cooldownMs: 140, knockback: 140, stunMs: 160 });
      }
    });
  }

  scene.time.delayedCall(300, () => { scene.meleeWeaponSwinging = false; });
}

export function updateMeleeWeaponPosition(scene) {
  if (!scene.meleeWeaponSprite || !scene.meleeWeaponSwinging) return;
  scene.meleeWeaponSprite.x = scene.player.x;
  scene.meleeWeaponSprite.y = scene.player.y;
}

export function raiseShield(scene) {
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
  console.log('Shield raised - now blocking!');
}

export function lowerShield(scene) {
  if (!scene.hasShield) { console.log('Cannot lower shield - no shield equipped!'); return; }
  scene.shieldRaised = false;
  if (scene.shieldSprite) { scene.shieldSprite.setVisible(false); scene.shieldSprite.body.enable = false; }
  console.log('Shield lowered - no longer blocking');
}

export function updateShieldPosition(scene) {
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
