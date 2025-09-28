/*
 AI-INDEX
 - Tags: engine.animations, mechanics.player
 - See: docs/ai/index.json
*/

/**
 * Character Animation System for Gold Hunter
 * 
 * Responsibilities:
 * - Create sprite-based animations for player character
 * - Manage animation states (idle, walking, attacking)
 * - Handle directional animations (4-way movement)
 * - Provide smooth animation transitions
 */

// Animation configuration
export const ANIMATION_CONFIG = {
  // Frame durations in milliseconds
  walkCycleDuration: 600,  // Full walk cycle
  idleBobDuration: 2000,   // Idle breathing/bob effect
  attackDuration: 300,     // Attack animation length
  
  // Animation timing
  walkFrameRate: 8,        // Frames per second for walking
  idleFrameRate: 2,        // Slow idle animation
  attackFrameRate: 12,     // Fast attack animation
  
  // Visual effects
  walkBobAmount: 1,        // Pixel offset for walk bob
  idleBobAmount: 0.5,      // Subtle idle movement
  attackRecoilAmount: 2,   // Attack recoil pixels
};

// Animation states
export const ANIMATION_STATES = {
  IDLE: 'idle',
  WALK_UP: 'walk_up',
  WALK_DOWN: 'walk_down', 
  WALK_LEFT: 'walk_left',
  WALK_RIGHT: 'walk_right',
  ATTACK_UP: 'attack_up',
  ATTACK_DOWN: 'attack_down',
  ATTACK_LEFT: 'attack_left',
  ATTACK_RIGHT: 'attack_right',
  HIT: 'hit'
};

/**
 * Character Animation Manager
 * Handles all player character animations
 */
export class CharacterAnimator {
  constructor(scene, playerSprite) {
    this.scene = scene;
    this.player = playerSprite;
    this.currentState = ANIMATION_STATES.IDLE;
    this.lastDirection = 'down';
    this.isAnimating = false;
    this.animationTween = null;
    this.walkTween = null;
    this.idleTween = null;
    
    // Store original position for relative animations
    this.baseY = playerSprite.y;
    
    this.initializeAnimations();
  }

  /**
   * Initialize all character animations
   */
  initializeAnimations() {
    // Since we're using a procedural sprite, we'll create movement-based animations
    // In production, you'd create sprite sheet animations here
    
    this.createIdleAnimation();
    console.log('CharacterAnimator: Initialized animations for player');
  }

  /**
   * Create subtle idle breathing animation
   */
  createIdleAnimation() {
    if (this.idleTween) {
      this.idleTween.stop();
    }
    
    // Subtle up-down bob for idle state
    this.idleTween = this.scene.tweens.add({
      targets: this.player,
      y: this.baseY - ANIMATION_CONFIG.idleBobAmount,
      duration: ANIMATION_CONFIG.idleBobDuration / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      paused: true
    });
  }

  /**
   * Update animation based on player state
   */
  update(velocity, isAttacking = false, direction = null) {
    const newDirection = direction || this.getDirectionFromVelocity(velocity);
    const isMoving = Math.abs(velocity.x) > 0 || Math.abs(velocity.y) > 0;
    
    // Determine new animation state
    let targetState = ANIMATION_STATES.IDLE;
    
    if (isAttacking) {
      targetState = this.getAttackState(newDirection);
    } else if (isMoving) {
      targetState = this.getWalkState(newDirection);
      this.lastDirection = newDirection;
    }
    
    // Update animation if state changed
    if (targetState !== this.currentState) {
      this.transitionToState(targetState);
    }
    
    // Update base position for relative animations
    if (!this.isAnimating) {
      this.baseY = this.player.y;
    }
  }

  /**
   * Get direction from velocity vector
   */
  getDirectionFromVelocity(velocity) {
    if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
      return velocity.x > 0 ? 'right' : 'left';
    } else if (Math.abs(velocity.y) > 0) {
      return velocity.y > 0 ? 'down' : 'up';
    }
    return this.lastDirection;
  }

  /**
   * Get walk animation state for direction
   */
  getWalkState(direction) {
    switch (direction) {
      case 'up': return ANIMATION_STATES.WALK_UP;
      case 'down': return ANIMATION_STATES.WALK_DOWN;
      case 'left': return ANIMATION_STATES.WALK_LEFT;
      case 'right': return ANIMATION_STATES.WALK_RIGHT;
      default: return ANIMATION_STATES.IDLE;
    }
  }

  /**
   * Get attack animation state for direction
   */
  getAttackState(direction) {
    switch (direction) {
      case 'up': return ANIMATION_STATES.ATTACK_UP;
      case 'down': return ANIMATION_STATES.ATTACK_DOWN;
      case 'left': return ANIMATION_STATES.ATTACK_LEFT;
      case 'right': return ANIMATION_STATES.ATTACK_RIGHT;
      default: return ANIMATION_STATES.ATTACK_DOWN;
    }
  }

  /**
   * Transition to new animation state
   */
  transitionToState(newState) {
    // Stop current animations
    this.stopCurrentAnimations();
    
    const oldState = this.currentState;
    this.currentState = newState;
    
    console.log(`CharacterAnimator: ${oldState} -> ${newState}`);
    
    // Start new animation
    switch (newState) {
      case ANIMATION_STATES.IDLE:
        this.playIdleAnimation();
        break;
      case ANIMATION_STATES.WALK_UP:
      case ANIMATION_STATES.WALK_DOWN:
      case ANIMATION_STATES.WALK_LEFT:
      case ANIMATION_STATES.WALK_RIGHT:
        this.playWalkAnimation(newState);
        break;
      case ANIMATION_STATES.ATTACK_UP:
      case ANIMATION_STATES.ATTACK_DOWN:
      case ANIMATION_STATES.ATTACK_LEFT:
      case ANIMATION_STATES.ATTACK_RIGHT:
        this.playAttackAnimation(newState);
        break;
      case ANIMATION_STATES.HIT:
        this.playHitAnimation();
        break;
    }
  }

  /**
   * Stop all current animations
   */
  stopCurrentAnimations() {
    if (this.animationTween) {
      this.animationTween.stop();
      this.animationTween = null;
    }
    if (this.walkTween) {
      this.walkTween.stop();
      this.walkTween = null;
    }
    if (this.idleTween) {
      this.idleTween.pause();
    }
    this.isAnimating = false;
  }

  /**
   * Play idle animation
   */
  playIdleAnimation() {
    if (this.idleTween) {
      this.idleTween.resume();
    }
  }

  /**
   * Play walking animation with bob effect
   */
  playWalkAnimation(walkState) {
    this.isAnimating = true;
    
    // Create walking bob effect
    this.walkTween = this.scene.tweens.add({
      targets: this.player,
      y: this.baseY - ANIMATION_CONFIG.walkBobAmount,
      duration: ANIMATION_CONFIG.walkCycleDuration / 4,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    // Add subtle side-to-side or up-down emphasis based on direction
    const direction = walkState.replace('walk_', '');
    this.addDirectionalMovement(direction);
  }

  /**
   * Add subtle directional movement emphasis
   */
  addDirectionalMovement(direction) {
    const emphasis = 0.5; // Subtle movement
    const duration = ANIMATION_CONFIG.walkCycleDuration / 2;
    
    let animationProps = {};
    
    switch (direction) {
      case 'left':
      case 'right':
        // Slight horizontal bob for horizontal movement
        animationProps.scaleX = direction === 'left' ? 0.98 : 1.02;
        break;
      case 'up':
        // Slight compress for upward movement
        animationProps.scaleY = 0.98;
        break;
      case 'down':
        // Slight stretch for downward movement  
        animationProps.scaleY = 1.02;
        break;
    }

    if (Object.keys(animationProps).length > 0) {
      this.scene.tweens.add({
        targets: this.player,
        ...animationProps,
        duration: duration,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1
      });
    }
  }

  /**
   * Play attack animation with recoil
   */
  playAttackAnimation(attackState) {
    this.isAnimating = true;
    const direction = attackState.replace('attack_', '');
    
    // Attack recoil based on direction
    let recoilX = 0, recoilY = 0;
    const recoil = ANIMATION_CONFIG.attackRecoilAmount;
    
    switch (direction) {
      case 'up': recoilY = recoil; break;
      case 'down': recoilY = -recoil; break;
      case 'left': recoilX = recoil; break;
      case 'right': recoilX = -recoil; break;
    }

    // Two-phase attack animation: wind-up and strike
    this.animationTween = this.scene.tweens.chain({
      targets: this.player,
      tweens: [
        {
          // Wind-up (slight pullback)
          x: this.player.x - recoilX * 0.3,
          y: this.player.y - recoilY * 0.3,
          scaleX: 0.95,
          scaleY: 1.05,
          duration: ANIMATION_CONFIG.attackDuration * 0.3,
          ease: 'Back.easeIn'
        },
        {
          // Strike (forward motion)
          x: this.player.x + recoilX,
          y: this.player.y + recoilY,
          scaleX: 1.05,
          scaleY: 0.95,
          duration: ANIMATION_CONFIG.attackDuration * 0.4,
          ease: 'Power2.easeOut'
        },
        {
          // Return to normal
          x: this.player.x,
          y: this.player.y,
          scaleX: 1,
          scaleY: 1,
          duration: ANIMATION_CONFIG.attackDuration * 0.3,
          ease: 'Elastic.easeOut',
          onComplete: () => {
            this.isAnimating = false;
            // Return to idle or walking state
            this.transitionToState(ANIMATION_STATES.IDLE);
          }
        }
      ]
    });
  }

  /**
   * Play hit/damage animation
   */
  playHitAnimation() {
    this.isAnimating = true;
    
    // Flash red and shake
    const originalTint = this.player.tint;
    
    this.animationTween = this.scene.tweens.add({
      targets: this.player,
      x: this.player.x + 2,
      scaleX: 0.9,
      scaleY: 1.1,
      duration: 100,
      ease: 'Power2.easeOut',
      yoyo: true,
      repeat: 1,
      onStart: () => {
        this.player.setTint(0xff6666); // Red tint
      },
      onComplete: () => {
        this.player.clearTint();
        this.isAnimating = false;
        this.transitionToState(ANIMATION_STATES.IDLE);
      }
    });
  }

  /**
   * Force a specific animation (e.g., for external triggers)
   */
  playAnimation(animationState) {
    this.transitionToState(animationState);
  }

  /**
   * Get current animation state
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * Check if currently playing an animation
   */
  isPlayingAnimation() {
    return this.isAnimating;
  }

  /**
   * Cleanup animations when destroyed
   */
  destroy() {
    this.stopCurrentAnimations();
    if (this.idleTween) {
      this.idleTween.destroy();
      this.idleTween = null;
    }
    console.log('CharacterAnimator: Destroyed');
  }
}

/**
 * Convenience functions for common animation operations
 */

// Initialize character animator for player
export function createCharacterAnimator(scene, playerSprite) {
  return new CharacterAnimator(scene, playerSprite);
}

// Update animations based on player state
export function updateCharacterAnimation(animator, velocity, isAttacking = false, direction = null) {
  if (animator) {
    animator.update(velocity, isAttacking, direction);
  }
}

// Trigger specific animations
export function playCharacterAnimation(animator, animationState) {
  if (animator) {
    animator.playAnimation(animationState);
  }
}

// Trigger hit animation when player takes damage
export function playPlayerHitAnimation(animator) {
  if (animator) {
    animator.playAnimation(ANIMATION_STATES.HIT);
  }
}

// Check if animation system is busy (for timing-sensitive operations)
export function isAnimationBusy(animator) {
  return animator ? animator.isPlayingAnimation() : false;
}