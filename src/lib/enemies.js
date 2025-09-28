/*
 AI-INDEX
 - Tags: mechanics.enemies, mechanics.combat
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import { ensureBatTexture } from './batSprite.js';
import { playEnemyAction } from './audio.js';
import { createHitEffect, createDeathEffect } from './particles.js';

// Lightweight enemy system with simple lifecycle and per-type updates

export function ensureGroups(scene) {
  if (!scene.enemiesGroup) scene.enemiesGroup = scene.add.group();
}

export function createEnemy(scene, type, x, y, opts = {}) {
  ensureGroups(scene);
  let enemy = null;
  switch (type) {
    case 'bat':
      enemy = createBat(scene, x, y, opts);
      break;
    case 'slime':
      enemy = createSlime(scene, x, y, opts);
      break;
    default:
      console.warn('Unknown enemy type:', type);
  }
  if (enemy) scene.enemiesGroup.add(enemy);
  return enemy;
}

export function updateEnemies(scene, time, delta) {
  if (!scene.enemiesGroup) return;
  for (const enemy of scene.enemiesGroup.getChildren()) {
    if (!enemy.active) continue;
    switch (enemy.enemyType) {
      case 'bat':
        updateBat(scene, enemy, time, delta);
        break;
      case 'slime':
        updateSlime(scene, enemy, time, delta);
        break;
    }
  }
}

// Freeze or unfreeze all enemies (disable physics bodies and zero velocity)
export function freezeEnemies(scene, frozen = true) {
  if (!scene.enemiesGroup) return;
  for (const enemy of scene.enemiesGroup.getChildren()) {
    const body = enemy.body;
    if (body) {
      if (frozen) {
        body.setVelocity(0, 0);
        body.enable = false;
      } else {
        body.enable = true;
        body.setVelocity(0, 0);
      }
    }
  }
}

// ------------------ Bat ------------------

function createBat(scene, x, y, opts) {
  const texKey = ensureBatTexture(scene);
  const bat = scene.physics.add.sprite(x, y, texKey);
  bat.body.setImmovable(false);
  bat.setDepth(2);
  bat.enemyType = 'bat';
  bat.maxHealth = opts.maxHealth ?? 20;
  bat.health = bat.maxHealth;
  bat.state = 'perched'; // 'perched' | 'chase' | 'return'
  bat.perchX = opts.perchX ?? x;
  bat.perchY = opts.perchY ?? y;
  bat.aggroRadius = opts.aggroRadius ?? 64;
  bat.deaggroRadius = opts.deaggroRadius ?? 120;
  bat.speed = opts.speed ?? 90;
  bat.leash = opts.leash ?? 160;
  bat.damage = opts.damage ?? 10;
  // Player knockback when bat hits the player
  bat.playerKnockback = opts.playerKnockback ?? 240; // default ~2x previous
  bat.playerKnockbackMs = opts.playerKnockbackMs ?? 200; // how long player control is damped
  bat.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9;
  bat.playerIFrameMs = opts.playerIFrameMs ?? 400;
  bat.knockbackDamping = opts.knockbackDamping ?? 0.9; // per-frame velocity multiplier while stunned
  // Pause the bat briefly after it hits the player (shorter for tougher enemies)
  bat.postHitPauseMs = opts.postHitPauseMs ?? 180;
  bat.hitCooldownMs = 600;
  bat._nextHitAt = 0;
  bat.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  // Set a compact body around the bat sprite (20x12 texture)
  if (bat.body.setSize) bat.body.setSize(12, 8);
  if (bat.body.setOffset) bat.body.setOffset(4, 2);
  if (scene.worldLayer) {
    try { scene.worldLayer.add(bat); } catch {}
  }

  // Overlap damage to player (respects shield)
  try {
    scene.physics.add.overlap(scene.player, bat, () => {
      const now = scene.time.now;
      if (now < bat._nextHitAt) return;
      bat._nextHitAt = now + bat.hitCooldownMs;
      if (!attemptEnemyDamagePlayer(scene, bat)) {
        // blocked by shield - optional feedback could go here
      }
    });
  } catch {}

  // Perch bobbing and subtle flap animation
  bat._bobbing = scene.tweens.add({
    targets: bat,
    y: bat.perchY - 1,
    yoyo: true,
    repeat: -1,
    duration: 600,
    ease: 'Sine.easeInOut'
  });
  bat._flap = scene.tweens.add({
    targets: bat,
    scaleY: 0.9,
    yoyo: true,
    repeat: -1,
    duration: 200,
    ease: 'Sine.easeInOut'
  });
  return bat;
}

function updateBat(scene, bat, time, delta) {
  const body = bat.body;
  if (!body) return;

  // If stunned, keep current knockback velocity and skip AI
  if (bat.stunUntil && time < bat.stunUntil) {
    // pause bob while stunned
    const bob = bat._bobbing; if (bob && !bob.isPaused()) bob.pause();
    // apply knockback damping so the bat slows down during stun
    try {
      const vx = bat.body.velocity.x; const vy = bat.body.velocity.y;
      const d = bat.knockbackDamping ?? 0.9;
      bat.body.setVelocity(vx * d, vy * d);
      if (Math.abs(bat.body.velocity.x) < 2 && Math.abs(bat.body.velocity.y) < 2) {
        bat.body.setVelocity(0, 0);
      }
    } catch {}
    return;
  }

  const px = scene.player?.x ?? bat.perchX;
  const py = scene.player?.y ?? bat.perchY;
  const distPlayer = Phaser.Math.Distance.Between(bat.x, bat.y, px, py);
  const distPerch = Phaser.Math.Distance.Between(bat.x, bat.y, bat.perchX, bat.perchY);

  // State transitions
  if (bat.state === 'perched') {
    body.setVelocity(0, 0);
    bat.x = bat.x; // noop keep
    if (distPlayer <= bat.aggroRadius) bat.state = 'chase';
  } else if (bat.state === 'chase') {
    if (distPlayer > bat.deaggroRadius || distPerch > bat.leash) bat.state = 'return';
  } else if (bat.state === 'return') {
    if (distPerch < 6) {
      bat.state = 'perched';
      bat.x = bat.perchX; bat.y = bat.perchY;
      body.setVelocity(0, 0);
      return;
    }
  }

  // Manage bobbing tween so it doesn't fight vertical movement
  const bob = bat._bobbing;
  if (bat.state === 'perched') {
    if (bob && bob.isPaused()) bob.resume();
  } else {
    if (bob && !bob.isPaused()) bob.pause();
  }

  // Movement behavior
  if (bat.state === 'chase') {
    const dx = px - bat.x, dy = py - bat.y;
    const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx / len) * bat.speed, (dy / len) * bat.speed);
  } else if (bat.state === 'return') {
    const dx = bat.perchX - bat.x, dy = bat.perchY - bat.y;
    const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx / len) * (bat.speed * 0.8), (dy / len) * (bat.speed * 0.8));
  } else {
    body.setVelocity(0, 0);
  }
}

// Convenience spawner for bats positioned on a tree grid cell
export function spawnBatAtGrid(scene, gridX, gridY, opts = {}) {
  const { x, y } = scene.gridToWorld(gridX, gridY);
  return createEnemy(scene, 'bat', x, y, { perchX: x, perchY: y, ...opts });
}

// ------------------ Slime ------------------

function createSlime(scene, x, y, opts) {
  const slime = scene.physics.add.sprite(x, y, null);
  // Render as a simple colored rectangle using a graphics-generated texture
  const g = scene.add.graphics();
  g.fillStyle(0x44aa44, 1);
  g.fillRect(0, 0, 12, 8);
  const key = `slime_${Math.random().toString(36).slice(2, 7)}`;
  g.generateTexture(key, 12, 8);
  g.destroy();
  slime.setTexture(key);
  slime.enemyType = 'slime';
  slime.setDepth(2);
  slime.maxHealth = opts.maxHealth ?? 18;
  slime.health = slime.maxHealth;
  slime.speed = opts.speed ?? 60;
  slime.damage = opts.damage ?? 6;
  // Player knockback when slime hits the player (simple enemy -> longer pause/knockback OK)
  slime.playerKnockback = opts.playerKnockback ?? 240;
  slime.playerKnockbackMs = opts.playerKnockbackMs ?? 240;
  slime.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9;
  slime.playerIFrameMs = opts.playerIFrameMs ?? 400;
  slime.knockbackDamping = opts.knockbackDamping ?? 0.9;
  slime.postHitPauseMs = opts.postHitPauseMs ?? 300;
  slime.aggroRadius = opts.aggroRadius ?? 56;
  slime.deaggroRadius = opts.deaggroRadius ?? 110;
  slime.wanderCooldown = 0;
  slime.state = 'wander'; // 'wander' | 'chase'
  slime.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  if (slime.body.setSize) slime.body.setSize(12, 8);
  if (scene.worldLayer) { try { scene.worldLayer.add(slime); } catch {} }
  try {
    scene.physics.add.overlap(scene.player, slime, () => {
      attemptEnemyDamagePlayer(scene, slime);
    });
  } catch {}
  return slime;
}

function updateSlime(scene, slime, time, delta) {
  if (!slime.body) return;
  // Stunned: keep velocity but damp it over time and skip AI
  if (slime.stunUntil && time < slime.stunUntil) {
    try {
      const vx = slime.body.velocity.x; const vy = slime.body.velocity.y;
      const d = slime.knockbackDamping ?? 0.9;
      slime.body.setVelocity(vx * d, vy * d);
      if (Math.abs(slime.body.velocity.x) < 2 && Math.abs(slime.body.velocity.y) < 2) {
        slime.body.setVelocity(0, 0);
      }
    } catch {}
    return;
  }
  const px = scene.player?.x ?? slime.x;
  const py = scene.player?.y ?? slime.y;
  const dist = Phaser.Math.Distance.Between(slime.x, slime.y, px, py);
  if (slime.state === 'wander' && dist <= slime.aggroRadius) slime.state = 'chase';
  if (slime.state === 'chase' && dist > slime.deaggroRadius) slime.state = 'wander';

  if (slime.state === 'chase') {
    const dx = px - slime.x, dy = py - slime.y;
    const len = Math.hypot(dx, dy) || 1;
    slime.body.setVelocity((dx / len) * slime.speed, (dy / len) * slime.speed);
  } else {
    // Wander: choose a random small impulse every second
    if (time >= slime.wanderCooldown) {
      slime.wanderCooldown = time + 1000 + Math.random() * 800;
      const angle = Math.random() * Math.PI * 2;
      slime.body.setVelocity(Math.cos(angle) * (slime.speed * 0.6), Math.sin(angle) * (slime.speed * 0.6));
    }
    // friction
    slime.body.setVelocity(slime.body.velocity.x * 0.98, slime.body.velocity.y * 0.98);
  }
}

export function spawnSlimeAtGrid(scene, gridX, gridY, opts = {}) {
  const { x, y } = scene.gridToWorld(gridX, gridY);
  return createEnemy(scene, 'slime', x, y, { ...opts });
}

// ------------------ Shared combat helpers ------------------

export function damageEnemy(scene, enemy, amount = 1, opts = {}) {
  if (!enemy || !enemy.active) return false;
  const now = scene.time?.now ?? 0;
  // Optional melee hit cooldown to avoid multiple ticks per swing
  if (opts.source === 'melee') {
    const cd = opts.cooldownMs ?? 120;
    if (enemy._nextMeleeHitAt && now < enemy._nextMeleeHitAt) return false;
    enemy._nextMeleeHitAt = now + cd;
  }
  enemy.health = (enemy.health ?? 1) - amount;
  
  // Play hit sound effect
  playEnemyAction(scene, enemy, 'hit');
  
  // Create hit particle effect
  createHitEffect(scene, enemy.x, enemy.y);
  
  // brief hit flash
  try { enemy.setTint?.(0xff6666); scene.time.delayedCall(80, () => enemy.clearTint?.()); } catch {}
  // floating damage number
  try {
    const dmgText = scene.add.text(enemy.x, enemy.y - 10, `${amount}`, { fontSize: '10px', color: '#ffea00' }).setOrigin(0.5).setDepth(999);
    scene.tweens.add({ targets: dmgText, y: dmgText.y - 16, alpha: 0, duration: 350, onComplete: () => dmgText.destroy() });
  } catch {}
  // Apply knockback + stun (direction away from hit origin if provided)
  try {
    const kb = opts.knockback ?? 110;
    const stunMs = opts.stunMs ?? 120;
    if (enemy.body) {
      const srcX = (opts.hitX ?? opts.from?.x ?? scene.player?.x ?? enemy.x);
      const srcY = (opts.hitY ?? opts.from?.y ?? scene.player?.y ?? enemy.y);
      const dx = enemy.x - srcX; const dy = enemy.y - srcY;
      const len = Math.hypot(dx, dy) || 1;
      enemy.body.setVelocity((dx / len) * kb, (dy / len) * kb);
      enemy.stunUntil = now + stunMs;
    }
  } catch {}
  if (enemy.health <= 0) {
    killEnemy(scene, enemy);
  }
  return true;
}

export function killEnemy(scene, enemy) {
  if (!enemy || !enemy.active) return;
  
  // Play death sound effect
  playEnemyAction(scene, enemy, 'death');
  
  // Create death particle effect
  createDeathEffect(scene, enemy.x, enemy.y);
  
  // Death puff FX
  try {
    const puff = scene.add.circle(enemy.x, enemy.y, 6, 0xffffff, 1);
    puff.setDepth((enemy.depth ?? 2) + 1);
    scene.tweens.add({ targets: puff, alpha: 0, scale: 1.8, duration: 200, onComplete: () => puff.destroy() });
  } catch {}
  try { enemy._bobbing?.stop(); enemy._flap?.stop(); } catch {}
  try { enemy.destroy(); } catch {}
}

function attemptEnemyDamagePlayer(scene, enemy) {
  const now = scene.time?.now ?? 0;
  if (scene._nextPlayerHitAt && now < scene._nextPlayerHitAt) return false;
  // If shield is raised and visible, block damage
  if (scene.shieldRaised && scene.shieldSprite && scene.shieldSprite.visible) {
    // Block FX: quick shield flash and spark
    try {
      scene.shieldSprite.setTint(0x88ccff);
      scene.time.delayedCall(80, () => scene.shieldSprite.clearTint());
      const spark = scene.add.circle(scene.shieldSprite.x, scene.shieldSprite.y, 3, 0x88ccff, 1);
      spark.setDepth(999);
      scene.tweens.add({ targets: spark, alpha: 0, scale: 1.5, duration: 150, onComplete: () => spark.destroy() });
    } catch {}
    return false;
  }
  if (typeof scene.takeDamage === 'function') scene.takeDamage(enemy.damage ?? 1);
  scene._nextPlayerHitAt = now + (enemy.playerIFrameMs ?? 400);
  try {
    if (scene.player?.setAlpha) {
      scene.player.setAlpha(0.7);
      scene.time.delayedCall(100, () => { try { scene.player.setAlpha(1); } catch {} });
    }
  } catch {}
  // Player knockback away from enemy
  try {
    if (scene.player?.body) {
      const dx = scene.player.x - enemy.x; const dy = scene.player.y - enemy.y;
      const len = Math.hypot(dx, dy) || 1;
      const kb = enemy.playerKnockback ?? 240;
      // Set initial knockback impulse
      scene.player.body.setVelocity((dx / len) * kb, (dy / len) * kb);
      // Mark knockback window so main update won't override movement
      scene.playerKnockbackUntil = now + (enemy.playerKnockbackMs ?? 200);
      scene.playerKnockbackDamping = enemy.playerKnockbackDamping ?? 0.9;
      // Briefly pause the enemy itself after a successful hit
      if (enemy.body) enemy.body.setVelocity(0, 0);
      enemy.stunUntil = Math.max(enemy.stunUntil ?? 0, now + (enemy.postHitPauseMs ?? 220));
    }
  } catch {}
  return true;
}
