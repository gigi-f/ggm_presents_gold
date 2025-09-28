/*
 AI-INDEX
 - Tags: engine.particles, mechanics.effects
 - See: docs/ai/index.json
*/

/**
 * Simple Particle System for Gold Hunter
 * 
 * Responsibilities:
 * - Create visual effects for combat, environment, and UI feedback
 * - Manage particle lifecycle and cleanup
 * - Provide optimized particle rendering
 * - Handle different particle types (sparks, dust, magic, etc.)
 */

// Particle type configurations
export const PARTICLE_TYPES = {
  COMBAT_HIT: {
    color: 0xffaa00,
    size: { min: 2, max: 4 },
    speed: { min: 50, max: 120 },
    lifetime: 300,
    gravity: 200,
    count: 8
  },
  WEAPON_TRAIL: {
    color: 0xcccccc,
    size: { min: 1, max: 2 },
    speed: { min: 20, max: 40 },
    lifetime: 200,
    gravity: 0,
    count: 4
  },
  CURRENCY_SPARKLE: {
    color: 0xffd700,
    size: { min: 1, max: 3 },
    speed: { min: 10, max: 30 },
    lifetime: 800,
    gravity: -50, // Float upward
    count: 6
  },
  ENEMY_DEATH: {
    color: 0xff6666,
    size: { min: 2, max: 5 },
    speed: { min: 40, max: 80 },
    lifetime: 400,
    gravity: 150,
    count: 12
  },
  ENVIRONMENT_DUST: {
    color: 0x996633, 
    size: { min: 1, max: 2 },
    speed: { min: 5, max: 15 },
    lifetime: 2000,
    gravity: 20,
    count: 3
  },
  MAGIC_SPARKLE: {
    color: 0x66ffff,
    size: { min: 1, max: 3 },
    speed: { min: 15, max: 35 },
    lifetime: 1000,
    gravity: -30,
    count: 8
  }
};

/**
 * Simple Particle System Manager
 */
export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.maxParticles = 200; // Performance limit
    this.cleanupTimer = 0;
    
    console.log('ParticleSystem: Initialized');
  }

  /**
   * Create a particle effect at specified location
   */
  emit(type, x, y, options = {}) {
    if (!PARTICLE_TYPES[type]) {
      console.warn(`ParticleSystem: Unknown particle type ${type}`);
      return;
    }

    const config = { ...PARTICLE_TYPES[type], ...options };
    
    // Don't exceed particle limit
    if (this.particles.length + config.count > this.maxParticles) {
      this.cleanup();
      if (this.particles.length + config.count > this.maxParticles) {
        return; // Still too many, skip this emission
      }
    }

    // Create particles
    for (let i = 0; i < config.count; i++) {
      this.createParticle(x, y, config);
    }
  }

  /**
   * Create individual particle
   */
  createParticle(x, y, config) {
    const size = this.randomBetween(config.size.min, config.size.max);
    const speed = this.randomBetween(config.speed.min, config.speed.max);
    const angle = Math.random() * Math.PI * 2;
    
    const particle = this.scene.add.circle(x, y, size, config.color, 0.8);
    particle.setDepth(100); // Above other objects
    
    // Particle physics properties
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;
    
    // Store particle data
    particle.particleData = {
      velocityX,
      velocityY,
      gravity: config.gravity,
      lifetime: config.lifetime,
      maxLifetime: config.lifetime,
      startTime: this.scene.time.now
    };

    this.particles.push(particle);
    return particle;
  }

  /**
   * Update all particles
   */
  update(time, delta) {
    const deltaSeconds = delta / 1000;
    
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      if (!particle || !particle.active || !particle.particleData) {
        this.particles.splice(i, 1);
        continue;
      }

      const data = particle.particleData;
      
      // Update lifetime
      data.lifetime -= delta;
      if (data.lifetime <= 0) {
        particle.destroy();
        this.particles.splice(i, 1);
        continue;
      }

      // Update position
      particle.x += data.velocityX * deltaSeconds;
      particle.y += data.velocityY * deltaSeconds;
      
      // Apply gravity
      data.velocityY += data.gravity * deltaSeconds;
      
      // Fade out based on lifetime
      const lifetimeRatio = data.lifetime / data.maxLifetime;
      particle.setAlpha(lifetimeRatio * 0.8);
      
      // Optional: slight size change based on lifetime
      const sizeRatio = 0.5 + (lifetimeRatio * 0.5);
      particle.setScale(sizeRatio);
    }

    // Periodic cleanup
    this.cleanupTimer += delta;
    if (this.cleanupTimer > 5000) { // Every 5 seconds
      this.cleanup();
      this.cleanupTimer = 0;
    }
  }

  /**
   * Clean up destroyed/invalid particles
   */
  cleanup() {
    this.particles = this.particles.filter(particle => {
      if (!particle || !particle.active) {
        try {
          particle?.destroy();
        } catch (e) {
          // Already destroyed
        }
        return false;
      }
      return true;
    });
  }

  /**
   * Get random number between min and max
   */
  randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Destroy all particles and cleanup
   */
  destroy() {
    this.particles.forEach(particle => {
      try {
        particle?.destroy();
      } catch (e) {
        // Already destroyed
      }
    });
    this.particles = [];
    console.log('ParticleSystem: Destroyed');
  }
}

/**
 * Convenience functions for common particle effects
 */

// Combat hit effect
export function createHitEffect(scene, x, y) {
  if (scene.particleSystem) {
    scene.particleSystem.emit('COMBAT_HIT', x, y);
  }
}

// Weapon swing trail
export function createWeaponTrail(scene, x, y) {
  if (scene.particleSystem) {
    scene.particleSystem.emit('WEAPON_TRAIL', x, y);
  }
}

// Currency pickup sparkle
export function createCurrencySparkle(scene, x, y) {
  if (scene.particleSystem) {
    scene.particleSystem.emit('CURRENCY_SPARKLE', x, y);
  }
}

// Enemy death explosion
export function createDeathEffect(scene, x, y) {
  if (scene.particleSystem) {
    scene.particleSystem.emit('ENEMY_DEATH', x, y);
  }
}

// Environmental dust (random world atmosphere)
export function createEnvironmentalDust(scene) {
  if (!scene.particleSystem) return;
  
  // Create random dust particles around the world
  const worldBounds = {
    x: scene.worldPixelWidth || 384,
    y: scene.worldPixelHeight || 288
  };
  
  const x = Math.random() * worldBounds.x;
  const y = Math.random() * worldBounds.y;
  
  scene.particleSystem.emit('ENVIRONMENT_DUST', x, y, { count: 1 });
}

// Magic/special effect sparkles
export function createMagicEffect(scene, x, y) {
  if (scene.particleSystem) {
    scene.particleSystem.emit('MAGIC_SPARKLE', x, y);
  }
}

// Utility: Create burst effect with custom parameters
export function createCustomBurst(scene, x, y, options = {}) {
  if (!scene.particleSystem) return;
  
  const customType = {
    color: options.color || 0xffffff,
    size: options.size || { min: 2, max: 4 },
    speed: options.speed || { min: 30, max: 60 },
    lifetime: options.lifetime || 500,
    gravity: options.gravity || 100,
    count: options.count || 6
  };
  
  // Temporarily add custom type
  const typeName = 'CUSTOM_' + Date.now();
  PARTICLE_TYPES[typeName] = customType;
  
  scene.particleSystem.emit(typeName, x, y);
  
  // Clean up custom type after a delay
  setTimeout(() => {
    delete PARTICLE_TYPES[typeName];
  }, 1000);
}