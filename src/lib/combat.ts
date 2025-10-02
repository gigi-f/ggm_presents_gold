/*
 AI-INDEX
 - Tags: mechanics.combat
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import { damageEnemy } from './enemies';
import { getShieldDisplaySize } from './economy';

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
  // Default weapon visual size; will be overridden by equippedWeapon.size or actual displayed sprite size
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

  // Ensure we create a visual that matches equipped weapon drawing when possible
  const desiredW = Math.round((weaponSize && weaponSize.width) ? weaponSize.width : 20);
  const desiredH = Math.round((weaponSize && weaponSize.height) ? weaponSize.height : 4);
  const eqSpriteKey = scene.equippedWeapon && scene.equippedWeapon.spriteKey ? scene.equippedWeapon.spriteKey : null;
  const hasTexture = eqSpriteKey && scene.textures && scene.textures.exists && scene.textures.exists(eqSpriteKey);
  if (!scene.meleeWeaponSprite) {
    // Create sprite anchored at inner edge (origin.x = 0) so it can pivot from the player's edge
    if (hasTexture) {
      scene.meleeWeaponSprite = scene.add.image(scene.player.x, scene.player.y, eqSpriteKey);
      try { scene.meleeWeaponSprite.setDisplaySize(desiredW, desiredH); } catch {}
    } else {
      scene.meleeWeaponSprite = scene.add.rectangle(scene.player.x, scene.player.y, desiredW, desiredH, weaponColor);
    }
    scene.meleeWeaponSprite.setOrigin(0, 0.5);
    scene.meleeWeaponSprite.setDepth(2);
    // Give the weapon a physics body so we can detect collisions with maze walls
    try {
      if (scene.physics && scene.physics.add && !scene.meleeWeaponSprite.body) {
        scene.physics.add.existing(scene.meleeWeaponSprite);
        if (scene.meleeWeaponSprite.body) {
          try { scene.meleeWeaponSprite.body.setAllowGravity?.(false); } catch {}
          try { scene.meleeWeaponSprite.body.setImmovable?.(true); } catch {}
          try { scene.meleeWeaponSprite.body.setSize(desiredW, desiredH, true); } catch {}
        }
      }
    } catch (e) {}
    // Create a one-time overlap between weapon and maze walls to cancel swings when player hits a wall
    try {
      if (!scene._weaponWallCollider && scene.mazeWalls && scene.physics && scene.physics.add) {
        scene._weaponWallCollider = scene.physics.add.overlap(scene.meleeWeaponSprite, scene.mazeWalls, (_w: any, _wall: any) => {
          try { onWeaponHitsWall(scene); } catch (e) {}
        });
      }
    } catch (e) {}
  } else {
    // Update existing sprite to match equipped weapon (image) or fallback rectangle
    if (hasTexture && scene.meleeWeaponSprite.setTexture) {
      try { scene.meleeWeaponSprite.setTexture(eqSpriteKey); } catch {}
      try { scene.meleeWeaponSprite.setDisplaySize(desiredW, desiredH); } catch {}
    } else if (scene.meleeWeaponSprite.setSize) {
      scene.meleeWeaponSprite.setSize(desiredW, desiredH);
      try { scene.meleeWeaponSprite.setFillStyle(weaponColor); } catch {}
    } else {
      // last resort: try to set display size
      try { scene.meleeWeaponSprite.setDisplaySize(desiredW, desiredH); } catch {}
    }
  }

  // If the displayed object has actual displayWidth/displayHeight, prefer those for hit reach
  try {
    if (scene.meleeWeaponSprite && scene.meleeWeaponSprite.displayWidth) {
      weaponSize = { width: scene.meleeWeaponSprite.displayWidth, height: scene.meleeWeaponSprite.displayHeight };
    }
  } catch {}

  scene.meleeWeaponSprite.setVisible(true);
  // Position the weapon's inner edge at the player's edge in the facing direction
  positionWeaponAtPlayerEdge(scene);

  let startAngle = -45, endAngle = 45;
  if (scene.lastDirection === 'left') { startAngle = -135; endAngle = -225; }
  else if (scene.lastDirection === 'up') { startAngle = -135; endAngle = -45; }
  else if (scene.lastDirection === 'down') { startAngle = 45; endAngle = 135; }

    scene.meleeWeaponSprite.setRotation(Phaser.Math.DegToRad(startAngle));
  // Store a reference to the tween so we can stop it if the weapon hits a wall
  try {
    scene._meleeWeaponTween = scene.tweens.add({
      targets: scene.meleeWeaponSprite,
      rotation: Phaser.Math.DegToRad(endAngle),
      duration: swingDuration,
      ease: 'Power2',
      onUpdate: () => updateMeleeWeaponPosition(scene),
      onComplete: () => { try { scene.meleeWeaponSprite.setVisible(false); } catch (e) {} }
    });
  } catch (e) {
    try { scene.meleeWeaponSprite.setVisible(false); } catch (e) {}
  }

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

  // Allow melee swings to pick up gold ingots within reach and frontal arc
  try {
    const golds: any[] = [];
    if (scene.worldLayer && Array.isArray(scene.worldLayer.list)) {
      for (const c of scene.worldLayer.list) {
        if (c && c.isGoldIngot) golds.push(c);
      }
    }
    for (const gold of golds) {
      if (!gold || !gold.active) continue;
      const dist = Phaser.Math.Distance.Between(scene.player.x, scene.player.y, gold.x, gold.y);
      if (dist > 36) continue; // same reach as enemies
      const dx = gold.x - scene.player.x; const dy = gold.y - scene.player.y;
      const goldAngle = Phaser.Math.RadToDeg(Math.atan2(dy, dx));
      const dirAngle = (() => {
        switch (scene.lastDirection) {
          case 'left': return 180;
          case 'up': return -90;
          case 'down': return 90;
          default: return 0; // right
        }
      })();
      const diff = Phaser.Math.Angle.WrapDegrees(goldAngle - dirAngle);
      if (Math.abs(diff) <= 60) {
        // Trigger pickup (MainScene implements pickupGoldIngot)
        try { if (typeof scene.pickupGoldIngot === 'function') scene.pickupGoldIngot(scene.player, gold); } catch (e) {}
      }
    }
  } catch (e) {}

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

  // Mark the end of swinging; keep a handle so we can cancel it on wall-hit
  try {
    if (scene._meleeSwingEndTimer) { try { scene._meleeSwingEndTimer.remove?.(); } catch {} }
    scene._meleeSwingEndTimer = scene.time.delayedCall(300, () => { scene.meleeWeaponSwinging = false; });
  } catch (e) { scene.time.delayedCall(300, () => { scene.meleeWeaponSwinging = false; }); }
}

export function updateMeleeWeaponPosition(scene: any) {
  if (!scene.meleeWeaponSprite || !scene.meleeWeaponSwinging) return;
  // Keep the inner edge anchored at the player's edge while swinging
  positionWeaponAtPlayerEdge(scene);
}

// Called when the melee weapon overlaps a maze wall. Cancels the swing and pushes the player back one grid cell.
function onWeaponHitsWall(scene: any) {
  if (!scene.meleeWeaponSwinging) return;
  scene.meleeWeaponSwinging = false;
  // stop tween if running
  try { scene._meleeWeaponTween?.stop?.(); } catch {}
  try { if (scene.meleeWeaponSprite) scene.meleeWeaponSprite.setVisible(false); } catch {}
  // cancel the swing-end timer
  try { scene._meleeSwingEndTimer?.remove?.(); } catch {}

  // Compute push-back direction (opposite of facing)
  let nx = 1, ny = 0;
  switch (scene.lastDirection) {
    case 'left': nx = -1; ny = 0; break;
    case 'up': nx = 0; ny = -1; break;
    case 'down': nx = 0; ny = 1; break;
    default: nx = 1; ny = 0; // right
  }
  const cs = scene.gridCellSize || 16;
  const player = scene.player;
  if (!player) return;
  const gx = Math.floor(player.x / cs);
  const gy = Math.floor(player.y / cs);
  const destGX = gx - nx;
  const destGY = gy - ny;
  const inBounds = (destGX >= 0 && destGX < (scene.gridWidth || 0) && destGY >= 0 && destGY < (scene.gridHeight || 0));
  const occupied = scene.occupiedCells && scene.occupiedCells.has(`${destGX},${destGY}`);
  if (inBounds && !occupied) {
    const worldX = destGX * cs + cs / 2;
    const worldY = destGY * cs + cs / 2;
    try {
  // Cancel any existing player push tween
  try { scene._playerPushTween?.stop?.(); } catch {}
  // If the player has a physics body, disable it for the tween to avoid conflicts
  try { if (player.body) { player.body.enable = false; } } catch {}
      // Tween the player's position to the target cell for a smooth push animation
      scene._playerPushTween = scene.tweens.add({
        targets: player,
        x: worldX,
        y: worldY,
        duration: 140,
        ease: 'Power2',
        onComplete: () => {
          // Re-enable/realign physics body after tween
          try {
            if (player.body) {
              // Prefer resetting the body if available
              try { if (typeof player.body.reset === 'function') player.body.reset(worldX, worldY); } catch {}
              try { player.body.enable = true; } catch {}
            }
          } catch (e) {}
        }
      });
    } catch (e) {
      // Fallback to instant placement
      try { player.x = worldX; player.y = worldY; } catch {}
      try { if (player.body && typeof player.body.reset === 'function') player.body.reset(worldX, worldY); } catch {}
    }
  } else {
    // If blocked, nudge the player a small distance opposite the facing direction
    try {
      const nudge = Math.max(4, Math.floor(cs * 0.4));
      const targetX = player.x - nx * nudge;
      const targetY = player.y - ny * nudge;
      // Cancel any existing player push tween
      try { scene._playerPushTween?.stop?.(); } catch {}
      try { if (player.body) player.body.enable = false; } catch {}
      scene._playerPushTween = scene.tweens.add({
        targets: player,
        x: targetX,
        y: targetY,
        duration: 120,
        ease: 'Sine.easeOut',
        onComplete: () => {
          try { if (player.body) { player.body.enable = true; try { player.body.velocity?.set?.(0,0); } catch {} } } catch {}
        }
      });
    } catch (e) {}
  }
  // Optional brief stun/lock to avoid immediate re-swing
  try {
    scene._justPushedBackUntil = (scene.time?.now ?? 0) + 180;
  } catch {}
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
  try {
    // Prefer explicit equipped shield size if provided
    if (scene.equippedShield && scene.equippedShield.size) {
      shieldColor = scene.equippedShield.color || shieldColor;
      shieldSize = scene.equippedShield.size;
    } else {
      // Otherwise derive size from price/quality
      const subtype = scene.shieldType || 'basic';
      try {
        const s = (typeof getShieldDisplaySize === 'function') ? getShieldDisplaySize(subtype) : null;
        if (s) shieldSize = s;
      } catch {}
      switch (scene.shieldType) {
        case 'basic': shieldColor = 0x654321; break;
        case 'strong': shieldColor = 0xC0C0C0; break;
        case 'light': shieldColor = 0x4169E1; break;
      }
    }
  } catch (e) {}
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
