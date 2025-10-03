/*
 AI-INDEX
 - Tags: mechanics.enemies, mechanics.combat
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import { ensureBatTexture } from './batSprite';
import { ensureWolfTexture } from './wolfSprite';
import * as World from './world';
import { ENEMY_DROP_CHANCES } from './constants';

export type Enemy = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody & {
  enemyType: 'bat' | 'slime' | 'wolf' | 'lad';
  maxHealth: number;
  health: number;
  damage: number;
  stunUntil?: number;
  persistentAcrossMaps?: boolean;
  // optional state specific fields
  [k: string]: any;
};

export function ensureGroups(scene: any) {
  if (!scene.enemiesGroup) scene.enemiesGroup = scene.add.group();
}

export function createEnemy(scene: any, type: 'bat'|'slime'|'wolf'|'lad', x: number, y: number, opts: any = {}): Enemy | null {
  ensureGroups(scene);
  let enemy: Enemy | null = null;
  switch (type) {
    case 'bat': enemy = createBat(scene, x, y, opts); break;
    case 'slime': enemy = createSlime(scene, x, y, opts); break;
    case 'wolf': enemy = createWolf(scene, x, y, opts); break;
    case 'lad': enemy = createLad(scene, x, y, opts); break;
    default: console.warn('Unknown enemy type:', type);
  }
  if (enemy) scene.enemiesGroup.add(enemy);
  return enemy;
}

export function updateEnemies(scene: any, time: number) {
  if (!scene.enemiesGroup) return;
  for (const enemy of scene.enemiesGroup.getChildren() as Enemy[]) {
    if (!enemy.active) continue;
    switch (enemy.enemyType) {
      case 'bat': updateBat(scene, enemy, time); break;
      case 'slime': updateSlime(scene, enemy, time); break;
      case 'wolf': updateWolf(scene, enemy, time); break;
      case 'lad': updateLad(scene, enemy, time); break;
    }
  }
}

export function freezeEnemies(scene: any, frozen = true) {
  if (!scene.enemiesGroup) return;
  for (const enemy of scene.enemiesGroup.getChildren() as Enemy[]) {
    const body = (enemy as any).body;
    if (body) {
      if (frozen) { body.setVelocity(0, 0); body.enable = false; }
      else { body.enable = true; body.setVelocity(0, 0); }
    }
  }
}

function createBat(scene: any, x: number, y: number, opts: any): Enemy {
  const texKey = ensureBatTexture(scene);
  const bat = scene.physics.add.sprite(x, y, texKey) as Enemy;
  bat.body.setImmovable(false);
  bat.setDepth(2);
  bat.enemyType = 'bat';
  bat.maxHealth = opts.maxHealth ?? 20;
  bat.health = bat.maxHealth;
  bat.state = 'perched';
  bat.perchX = opts.perchX ?? x;
  bat.perchY = opts.perchY ?? y;
  bat.aggroRadius = opts.aggroRadius ?? 64;
  bat.deaggroRadius = opts.deaggroRadius ?? 120;
  bat.speed = opts.speed ?? 90;
  bat.leash = opts.leash ?? 160;
  bat.damage = opts.damage ?? 10;
  bat.playerKnockback = opts.playerKnockback ?? 240;
  bat.playerKnockbackMs = opts.playerKnockbackMs ?? 200;
  bat.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9;
  bat.playerIFrameMs = opts.playerIFrameMs ?? 400;
  bat.knockbackDamping = opts.knockbackDamping ?? 0.9;
  bat.postHitPauseMs = opts.postHitPauseMs ?? 180;
  bat.hitCooldownMs = 600;
  bat._nextHitAt = 0;
  bat.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  if (bat.body.setSize) bat.body.setSize(12, 8);
  if (bat.body.setOffset) bat.body.setOffset(4, 2);
  if (scene.worldLayer) { try { scene.worldLayer.add(bat); } catch {} }

  try {
    scene.physics.add.overlap(scene.player, bat, () => {
      const now = scene.time.now;
      if (now < bat._nextHitAt) return;
      bat._nextHitAt = now + bat.hitCooldownMs;
      if (!(attemptEnemyDamagePlayer(scene, bat))) {
        // blocked by shield
      }
    });
  } catch {}

  bat._bobbing = scene.tweens.add({ targets: bat, y: bat.perchY - 1, yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut' });
  bat._flap = scene.tweens.add({ targets: bat, scaleY: 0.9, yoyo: true, repeat: -1, duration: 200, ease: 'Sine.easeInOut' });
  return bat;
}

function updateBat(scene: any, bat: Enemy, time: number) {
  const body = (bat as any).body; if (!body) return;
  if ((bat as any).stunUntil && time < (bat as any).stunUntil) {
    const vx = body.velocity.x; const vy = body.velocity.y;
    const d = (bat as any).knockbackDamping ?? 0.9;
    body.setVelocity(vx * d, vy * d);
    if (Math.abs(body.velocity.x) < 2 && Math.abs(body.velocity.y) < 2) body.setVelocity(0, 0);
    return;
  }
  const px = scene.player?.x ?? (bat as any).perchX;
  const py = scene.player?.y ?? (bat as any).perchY;
  const distPlayer = Phaser.Math.Distance.Between(bat.x, bat.y, px, py);
  const distPerch = Phaser.Math.Distance.Between(bat.x, bat.y, (bat as any).perchX, (bat as any).perchY);
  if ((bat as any).state === 'perched') {
    body.setVelocity(0, 0);
    if (distPlayer <= (bat as any).aggroRadius) (bat as any).state = 'chase';
  } else if ((bat as any).state === 'chase') {
    if (distPlayer > (bat as any).deaggroRadius || distPerch > (bat as any).leash) (bat as any).state = 'return';
  } else if ((bat as any).state === 'return') {
    if (distPerch < 6) {
      (bat as any).state = 'perched';
      bat.x = (bat as any).perchX; bat.y = (bat as any).perchY;
      body.setVelocity(0, 0);
      return;
    }
  }
  const bob = (bat as any)._bobbing;
  if ((bat as any).state === 'perched') { if (bob && bob.isPaused()) bob.resume(); }
  else { if (bob && !bob.isPaused()) bob.pause(); }
  if ((bat as any).state === 'chase') {
    const dx = px - bat.x, dy = py - bat.y; const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx/len) * (bat as any).speed, (dy/len) * (bat as any).speed);
  } else if ((bat as any).state === 'return') {
    const dx = (bat as any).perchX - bat.x, dy = (bat as any).perchY - bat.y; const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx/len) * ((bat as any).speed * 0.8), (dy/len) * ((bat as any).speed * 0.8));
  } else {
    body.setVelocity(0, 0);
  }
}

export function spawnBatAtGrid(scene: any, gridX: number, gridY: number, opts: any = {}) {
  const { x, y } = scene.gridToWorld(gridX, gridY);
  return createEnemy(scene, 'bat', x, y, { perchX: x, perchY: y, ...opts });
}

function createSlime(scene: any, x: number, y: number, opts: any): Enemy {
  // Prefer a small blob sprite if preloaded; otherwise generate a simple green rectangle texture.
  let texKey: string | null = null;
  try { if (scene.textures && scene.textures.exists('blob')) texKey = 'blob'; } catch {}
  if (texKey) {
    const slime = scene.physics.add.sprite(x, y, texKey) as Enemy;
    // Force display size to match previous generated texture (12x8)
    try { slime.setDisplaySize(12, 8); } catch {}
    slime.enemyType = 'slime'; slime.setDepth(2);
    slime.maxHealth = opts.maxHealth ?? 18; slime.health = slime.maxHealth;
    slime.speed = opts.speed ?? 60; slime.damage = opts.damage ?? 6;
    slime.playerKnockback = opts.playerKnockback ?? 240; slime.playerKnockbackMs = opts.playerKnockbackMs ?? 240; slime.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9; slime.playerIFrameMs = opts.playerIFrameMs ?? 400; slime.knockbackDamping = opts.knockbackDamping ?? 0.9; slime.postHitPauseMs = opts.postHitPauseMs ?? 300; slime.aggroRadius = opts.aggroRadius ?? 56; slime.deaggroRadius = opts.deaggroRadius ?? 110; slime.wanderCooldown = 0; slime.state = 'wander'; slime.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  if ((slime as any).body.setSize) { (slime as any).body.setSize(12, 8); if ((slime as any).body.setOffset) try { (slime as any).body.setOffset(0, 0); } catch {} }
    if (scene.worldLayer) { try { scene.worldLayer.add(slime); } catch {} }
    try { scene.physics.add.overlap(scene.player, slime, () => { attemptEnemyDamagePlayer(scene, slime); }); } catch {}
    return slime;
  }
  const slime = scene.physics.add.sprite(x, y, null) as Enemy;
  const g = scene.add.graphics();
  g.fillStyle(0x44aa44, 1); g.fillRect(0, 0, 12, 8);
  const key = `slime_${Math.random().toString(36).slice(2, 7)}`; g.generateTexture(key, 12, 8); g.destroy();
  slime.setTexture(key);
  slime.enemyType = 'slime'; slime.setDepth(2);
  slime.maxHealth = opts.maxHealth ?? 18; slime.health = slime.maxHealth;
  slime.speed = opts.speed ?? 60; slime.damage = opts.damage ?? 6;
  slime.playerKnockback = opts.playerKnockback ?? 240; slime.playerKnockbackMs = opts.playerKnockbackMs ?? 240; slime.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9; slime.playerIFrameMs = opts.playerIFrameMs ?? 400; slime.knockbackDamping = opts.knockbackDamping ?? 0.9; slime.postHitPauseMs = opts.postHitPauseMs ?? 300; slime.aggroRadius = opts.aggroRadius ?? 56; slime.deaggroRadius = opts.deaggroRadius ?? 110; slime.wanderCooldown = 0; slime.state = 'wander'; slime.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  if ((slime as any).body.setSize) (slime as any).body.setSize(12, 8);
  if (scene.worldLayer) { try { scene.worldLayer.add(slime); } catch {} }
  try { scene.physics.add.overlap(scene.player, slime, () => { attemptEnemyDamagePlayer(scene, slime); }); } catch {}
  return slime;
}

function updateSlime(scene: any, slime: Enemy, time: number) {
  const body = (slime as any).body; if (!body) return;
  if ((slime as any).stunUntil && time < (slime as any).stunUntil) {
    const vx = body.velocity.x; const vy = body.velocity.y; const d = (slime as any).knockbackDamping ?? 0.9;
    body.setVelocity(vx * d, vy * d); if (Math.abs(body.velocity.x) < 2 && Math.abs(body.velocity.y) < 2) body.setVelocity(0, 0);
    return;
  }
  const px = scene.player?.x ?? slime.x; const py = scene.player?.y ?? slime.y;
  const dist = Phaser.Math.Distance.Between(slime.x, slime.y, px, py);
  if ((slime as any).state === 'wander' && dist <= (slime as any).aggroRadius) (slime as any).state = 'chase';
  if ((slime as any).state === 'chase' && dist > (slime as any).deaggroRadius) (slime as any).state = 'wander';
  if ((slime as any).state === 'chase') {
    const dx = px - slime.x, dy = py - slime.y; const len = Math.hypot(dx, dy) || 1; body.setVelocity((dx/len) * (slime as any).speed, (dy/len) * (slime as any).speed);
  } else {
    if (time >= (slime as any).wanderCooldown) { (slime as any).wanderCooldown = time + 1000 + Math.random() * 800; const angle = Math.random() * Math.PI * 2; body.setVelocity(Math.cos(angle) * ((slime as any).speed * 0.6), Math.sin(angle) * ((slime as any).speed * 0.6)); }
    body.setVelocity(body.velocity.x * 0.98, body.velocity.y * 0.98);
  }
}

export function spawnSlimeAtGrid(scene: any, gridX: number, gridY: number, opts: any = {}) {
  const { x, y } = scene.gridToWorld(gridX, gridY);
  return createEnemy(scene, 'slime', x, y, { ...opts });
}

export function damageEnemy(scene: any, enemy: Enemy, amount = 1, opts: any = {}) {
  if (!enemy || !enemy.active) return false;
  const now = scene.time?.now ?? 0;
  if (opts.source === 'melee') {
    const cd = opts.cooldownMs ?? 120;
    if ((enemy as any)._nextMeleeHitAt && now < (enemy as any)._nextMeleeHitAt) return false;
    (enemy as any)._nextMeleeHitAt = now + cd;
  }
  enemy.health = (enemy.health ?? 1) - amount;
  try { (enemy as any).setTint?.(0xff6666); scene.time.delayedCall(80, () => (enemy as any).clearTint?.()); } catch {}
  try { const dmgText = scene.add.text(enemy.x, enemy.y - 10, `${amount}`, { fontSize: '10px', color: '#ffea00' }).setOrigin(0.5).setDepth(999); scene.tweens.add({ targets: dmgText, y: dmgText.y - 16, alpha: 0, duration: 350, onComplete: () => dmgText.destroy() }); } catch {}
  try {
    const kb = opts.knockback ?? 110; const stunMs = opts.stunMs ?? 120; if ((enemy as any).body) {
      const srcX = (opts.hitX ?? opts.from?.x ?? scene.player?.x ?? enemy.x); const srcY = (opts.hitY ?? opts.from?.y ?? scene.player?.y ?? enemy.y);
      const dx = enemy.x - srcX; const dy = enemy.y - srcY; const len = Math.hypot(dx, dy) || 1;
      (enemy as any).body.setVelocity((dx/len) * kb, (dy/len) * kb); (enemy as any).stunUntil = now + stunMs;
    }
  } catch {}
  if (enemy.health <= 0) { killEnemy(scene, enemy); }
  return true;
}

export function killEnemy(scene: any, enemy: Enemy) {
  if (!enemy || !enemy.active) return;
  try { const puff = scene.add.circle(enemy.x, enemy.y, 6, 0xffffff, 1); puff.setDepth((enemy.depth ?? 2) + 1); scene.tweens.add({ targets: puff, alpha: 0, scale: 1.8, duration: 200, onComplete: () => puff.destroy() }); } catch {}
  try { (enemy as any)._bobbing?.stop(); (enemy as any)._flap?.stop(); } catch {}
  // Chance to drop currency on death: weak enemies (bat, slime) rarely drop copper; strong (wolf) rarely drop silver
  try {
    const r = Math.random();
    let dropType: 'copper' | 'silver' | null = null;
    // Drop chances are configured in constants
    if (enemy.enemyType === 'bat' || enemy.enemyType === 'slime') {
      if (r < (ENEMY_DROP_CHANCES.WEAK_COPPER ?? 0.08)) dropType = 'copper';
    } else if (enemy.enemyType === 'wolf') {
      if (r < (ENEMY_DROP_CHANCES.STRONG_SILVER ?? 0.05)) dropType = 'silver';
    }
    if (dropType) {
      try {
        const q = World.quantizeWorldPosition(scene, enemy.x, enemy.y, { markOccupied: false });
        const coin = World.placeObjectOnGrid(scene, q.gridX, q.gridY, 'currency', null, { type: dropType });
        if (coin) {
          try { scene.physics.add.overlap(scene.player, coin, scene.pickupCurrency, null, scene); } catch {}
        }
      } catch {}
    }
  } catch {}

  try { (enemy as any).destroy(); } catch {}
}

function attemptEnemyDamagePlayer(scene: any, enemy: Enemy) {
  const now = scene.time?.now ?? 0; if (scene._nextPlayerHitAt && now < scene._nextPlayerHitAt) return false;
  if (enemy.enemyType === 'lad' && scene.goldIngotsCount && scene.goldIngotsCount > 0 && scene.collectedGoldIds && scene.collectedGoldIds.size > 0) {
    // Steal one gold ingot
    const stolenId = scene.collectedGoldIds.values().next().value;
    scene.collectedGoldIds.delete(stolenId);
    scene.goldIngotsCount = Math.max(0, scene.goldIngotsCount - 1);
    try { scene.scene.get && scene.scene.get('UIScene')?.updateGoldIngots?.(scene.goldIngotsCount, scene.goldGoal); } catch {}
    scene.showToast?.('Lad stole a gold ingot!');
    // Only steal, do not deal damage
    scene._nextPlayerHitAt = now + ((enemy as any).playerIFrameMs ?? 400);
    return true;
  }
  if (typeof scene.takeDamage === 'function') scene.takeDamage(enemy.damage ?? 1);
  scene._nextPlayerHitAt = now + ((enemy as any).playerIFrameMs ?? 400);
  try { if (scene.player?.setAlpha) { scene.player.setAlpha(0.7); scene.time.delayedCall(100, () => { try { scene.player.setAlpha(1); } catch {} }); } } catch {}
  try {
    if (scene.player?.body) {
      const kb = (enemy as any).playerKnockback ?? 240; let dx = scene.player.x - enemy.x; let dy = scene.player.y - enemy.y; let len = Math.hypot(dx, dy) || 1; let dir = { x: dx / len, y: dy / len };
      dir = chooseSafeKnockbackDir(scene, scene.player, dir.x, dir.y, enemy);
      scene.player.body.setVelocity(dir.x * kb, dir.y * kb);
      scene.playerKnockbackUntil = now + ((enemy as any).playerKnockbackMs ?? 200); scene.playerKnockbackDamping = (enemy as any).playerKnockbackDamping ?? 0.9; if ((enemy as any).body) (enemy as any).body.setVelocity(0, 0); (enemy as any).stunUntil = Math.max((enemy as any).stunUntil ?? 0, now + ((enemy as any).postHitPauseMs ?? 220));
    }
  } catch {}
  return true;
}

function isBlockedAt(scene: any, cx: number, cy: number, w: number, h: number, ignoreBody: any, enemyContext: Enemy | null = null) {
  try {
    const hits = scene.physics.world.overlapRect(cx - w / 2, cy - h / 2, w, h, true, true);
    for (const b of hits) {
      if (!b || !b.enable) continue; if (ignoreBody && b === ignoreBody) continue;
      const isFlyingEnemy = enemyContext && (enemyContext as any).enemyType === 'bat';
      if (b.immovable && !isFlyingEnemy) return true;
    }
  } catch {}
  return false;
}

function chooseSafeKnockbackDir(scene: any, player: any, dx: number, dy: number, enemyContext: Enemy | null = null) {
  const body = player.body; if (!body) return { x: dx, y: dy };
  const step = Math.max(8, Math.ceil(Math.max(body.width, body.height) * 0.75));
  const sdx = Math.sign(dx) || 0; const sdy = Math.sign(dy) || 0; const cand: Array<{x:number;y:number}> = [];
  cand.push({ x: dx, y: dy }); cand.push({ x: -dx, y: -dy });
  if (sdx !== 0) cand.push({ x: sdx, y: 0 }); if (sdy !== 0) cand.push({ x: 0, y: sdy });
  if (sdx !== 0) cand.push({ x: -sdx, y: 0 }); if (sdy !== 0) cand.push({ x: 0, y: -sdy });
  for (let i = 0; i < cand.length; i++) {
    const v = cand[i]; const len = Math.hypot(v.x, v.y) || 1; const ux = v.x / len, uy = v.y / len; const testX = player.x + ux * step; const testY = player.y + uy * step;
    if (!isBlockedAt(scene, testX, testY, body.width, body.height, body, enemyContext)) return { x: ux, y: uy };
  }
  return { x: 0, y: 0 };
}

function createWolf(scene: any, x: number, y: number, opts: any): Enemy {
  const texKey = ensureWolfTexture(scene);
  const wolf = scene.physics.add.sprite(x, y, texKey) as Enemy;
  wolf.enemyType = 'wolf'; wolf.setDepth(2);
  const cs = scene.gridCellSize ?? 16; try { wolf.setDisplaySize(cs * 2, cs); } catch {}
  wolf.maxHealth = opts.maxHealth ?? 28; wolf.health = wolf.maxHealth; wolf.damage = opts.damage ?? 12; wolf.speed = opts.speed ?? 110; wolf.chargeSpeed = opts.chargeSpeed ?? 260; wolf.windupMs = opts.windupMs ?? 160; wolf.chargeDurationMs = opts.chargeDurationMs ?? 360; wolf.recoverMs = opts.recoverMs ?? 240; wolf.aggroRadius = opts.aggroRadius ?? 170; wolf.deaggroRadius = opts.deaggroRadius ?? 320; wolf.leash = opts.leash ?? 320; wolf.state = 'idle'; wolf.homeX = opts.homeX ?? x; wolf.homeY = opts.homeY ?? y; wolf._phaseUntil = 0; wolf._chargeEndAt = 0; wolf.playerKnockback = opts.playerKnockback ?? 300; wolf.playerKnockbackMs = opts.playerKnockbackMs ?? 200; wolf.playerKnockbackDamping = opts.playerKnockbackDamping ?? 0.9; wolf.playerIFrameMs = opts.playerIFrameMs ?? 400; wolf.knockbackDamping = opts.knockbackDamping ?? 0.9; wolf.postHitPauseMs = opts.postHitPauseMs ?? 160; wolf.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  try { const bw = cs * 2 - 4; const bh = cs - 4; (wolf as any).body.setSize(bw, bh); const offX = (wolf.displayWidth - bw) / 2; const offY = (wolf.displayHeight - bh) / 2; if ((wolf as any).body.setOffset) (wolf as any).body.setOffset(offX, offY); } catch {}
  if (scene.worldLayer) { try { scene.worldLayer.add(wolf); } catch {} }
  try { scene.physics.add.overlap(scene.player, wolf, () => { attemptEnemyDamagePlayer(scene, wolf); }); } catch {}
  return wolf;
}

function updateWolf(scene: any, wolf: Enemy, time: number) {
  const body = (wolf as any).body; if (!body) return;
  if ((wolf as any).stunUntil && time < (wolf as any).stunUntil) {
    try { const vx = body.velocity.x, vy = body.velocity.y; const d = (wolf as any).knockbackDamping ?? 0.9; body.setVelocity(vx * d, vy * d); if (Math.abs(body.velocity.x) < 2 && Math.abs(body.velocity.y) < 2) body.setVelocity(0, 0); } catch {}
    return;
  }
  const px = scene.player?.x ?? (wolf as any).homeX; const py = scene.player?.y ?? (wolf as any).homeY; const distPlayer = Phaser.Math.Distance.Between(wolf.x, wolf.y, px, py); const distHome = Phaser.Math.Distance.Between(wolf.x, wolf.y, (wolf as any).homeX, (wolf as any).homeY);
  switch ((wolf as any).state) {
    case 'idle': body.setVelocity(0, 0); if (distPlayer <= (wolf as any).aggroRadius) (wolf as any).state = 'stalk'; break;
    case 'stalk':
      if (distPlayer > (wolf as any).deaggroRadius || distHome > (wolf as any).leash) { (wolf as any).state = 'return'; break; }
      if (!(wolf as any)._nextWindupAt || time >= (wolf as any)._nextWindupAt || distPlayer < 96) {
        (wolf as any).state = 'windup'; (wolf as any)._phaseUntil = time + (wolf as any).windupMs; (wolf as any)._lockTargetX = px; (wolf as any)._lockTargetY = py; body.setVelocity(0, 0);
      }
      break;
    case 'windup': body.setVelocity(0, 0); if (time >= (wolf as any)._phaseUntil) { (wolf as any).state = 'charge'; const dx = ((wolf as any)._lockTargetX ?? px) - wolf.x; const dy = ((wolf as any)._lockTargetY ?? py) - wolf.y; const len = Math.hypot(dx, dy) || 1; body.setVelocity((dx/len) * (wolf as any).chargeSpeed, (dy/len) * (wolf as any).chargeSpeed); (wolf as any)._chargeEndAt = time + (wolf as any).chargeDurationMs; } break;
    case 'charge': if (time >= (wolf as any)._chargeEndAt) { (wolf as any).state = 'recover'; (wolf as any)._phaseUntil = time + (wolf as any).recoverMs; body.setVelocity(0, 0); } else if (distPlayer > (wolf as any).deaggroRadius || distHome > (wolf as any).leash) { (wolf as any).state = 'return'; } break;
    case 'recover': body.setVelocity(0, 0); if (time >= (wolf as any)._phaseUntil) { (wolf as any)._nextWindupAt = time + 300 + Math.random() * 500; (wolf as any).state = (distPlayer <= (wolf as any).aggroRadius) ? 'stalk' : 'return'; } break;
    case 'return': if (distHome < 6) { (wolf as any).state = 'idle'; body.setVelocity(0, 0); break; }
  }
  if ((wolf as any).state === 'stalk') { const dx = px - wolf.x, dy = py - wolf.y; const len = Math.hypot(dx, dy) || 1; body.setVelocity((dx/len) * (wolf as any).speed, (dy/len) * (wolf as any).speed); }
  else if ((wolf as any).state === 'return') { const dx = (wolf as any).homeX - wolf.x, dy = (wolf as any).homeY - wolf.y; const len = Math.hypot(dx, dy) || 1; body.setVelocity((dx/len) * (wolf as any).speed, (dy/len) * (wolf as any).speed); }
}

export function spawnWolfAtGrid(scene: any, gridX: number, gridY: number, opts: any = {}) {
  const { x, y } = scene.gridToWorld(gridX, gridY);
  return createEnemy(scene, 'wolf', x, y, { homeX: x, homeY: y, ...opts });
}

function createLad(scene: any, x: number, y: number, opts: any): Enemy {
  // Use lad_left.png and lad_right.png for left/right facing
  const lad = scene.physics.add.sprite(x, y, 'lad_right') as Enemy;
  lad.enemyType = 'lad';
  lad.setDepth(2);
  lad.maxHealth = opts.maxHealth ?? 22;
  lad.health = lad.maxHealth;
  lad.speed = opts.speed ?? 80;
  lad.sprintSpeed = opts.sprintSpeed ?? 220;
  lad.damage = opts.damage ?? 8;
  lad.state = opts.sprintTarget ? 'sprint' : 'wander';
  lad.direction = 'right';
  lad.wanderCooldown = 0;
  lad.aggroRadius = opts.aggroRadius ?? 9999; // always see player
  lad.deaggroRadius = opts.deaggroRadius ?? 99999;
  lad.sprintTarget = opts.sprintTarget || null;
  lad.sightLine = true;
  lad.persistentAcrossMaps = !!opts.persistentAcrossMaps;
  // Display size (match sprite asset)
  try { lad.setDisplaySize(16, 16); } catch {}
  if (scene.worldLayer) { try { scene.worldLayer.add(lad); } catch {} }
  // Overlap with player for damage
  try { scene.physics.add.overlap(scene.player, lad, () => { attemptEnemyDamagePlayer(scene, lad); }); } catch {}
  return lad;
}

function updateLad(scene: any, lad: Enemy, time: number) {
  const body = (lad as any).body; if (!body) return;
  if ((lad as any).stunUntil && time < (lad as any).stunUntil) {
    const vx = body.velocity.x; const vy = body.velocity.y;
    const d = (lad as any).knockbackDamping ?? 0.9;
    body.setVelocity(vx * d, vy * d);
    if (Math.abs(body.velocity.x) < 2 && Math.abs(body.velocity.y) < 2) body.setVelocity(0, 0);
    return;
  }
  const px = scene.player?.x ?? lad.x;
  const py = scene.player?.y ?? lad.y;
  // Sight line: if direct line to player (no wall blocking), always chase
  let canSeePlayer = true;
  if (scene.mazeWalls && scene.mazeWalls.getChildren) {
    const ray = new Phaser.Geom.Line(lad.x, lad.y, px, py);
    for (const wall of scene.mazeWalls.getChildren()) {
      if (!wall?.body) continue;
      const rect = new Phaser.Geom.Rectangle(wall.body.x, wall.body.y, wall.body.width, wall.body.height);
      if (Phaser.Geom.Intersects.LineToRectangle(ray, rect)) {
        canSeePlayer = false;
        break;
      }
    }
  }
  if ((lad as any).state === 'sprint' && (lad as any).sprintTarget) {
    // Sprint toward initial target
    const tx = (lad as any).sprintTarget.x, ty = (lad as any).sprintTarget.y;
    const dx = tx - lad.x, dy = ty - lad.y; const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx/len) * (lad as any).sprintSpeed, (dy/len) * (lad as any).sprintSpeed);
    if (Math.abs(dx) > Math.abs(dy)) {
      lad.setTexture(dx < 0 ? 'lad_left' : 'lad_right');
      lad.direction = dx < 0 ? 'left' : 'right';
    }
    // If close to target, switch to chase
    if (Phaser.Math.Distance.Between(lad.x, lad.y, tx, ty) < 12) {
      (lad as any).state = 'chase';
      (lad as any).sprintTarget = null;
    }
    return;
  }
  // Aggro logic: always chase if can see player
  if (canSeePlayer) {
    (lad as any).state = 'chase';
    const dx = px - lad.x, dy = py - lad.y; const len = Math.hypot(dx, dy) || 1;
    body.setVelocity((dx/len) * ((lad as any).sprintSpeed ?? 220), (dy/len) * ((lad as any).sprintSpeed ?? 220));
    if (Math.abs(dx) > Math.abs(dy)) {
      lad.setTexture(dx < 0 ? 'lad_left' : 'lad_right');
      lad.direction = dx < 0 ? 'left' : 'right';
    }
    return;
  }
  // Otherwise, wander
  if ((lad as any).state === 'wander') {
    if (time >= (lad as any).wanderCooldown) {
      (lad as any).wanderCooldown = time + 1000 + Math.random() * 800;
      const angle = Math.random() * Math.PI * 2;
      body.setVelocity(Math.cos(angle) * ((lad as any).speed * 0.6), Math.sin(angle) * ((lad as any).speed * 0.6));
      lad.setTexture(body.velocity.x < 0 ? 'lad_left' : 'lad_right');
      lad.direction = body.velocity.x < 0 ? 'left' : 'right';
    }
    body.setVelocity(body.velocity.x * 0.98, body.velocity.y * 0.98);
  }
  // Lad ignores maze/wall blocking: do not check isBlockedAt
}
