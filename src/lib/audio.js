/*
 AI-INDEX
 - Tags: engine.audio, mechanics.audio
 - See: docs/ai/index.json
*/

/**
 * Audio Manager for Gold Hunter
 * 
 * Responsibilities:
 * - Background music management with transitions
 * - Sound effect playback with spatial audio
 * - Volume controls and audio mixing
 * - Performance-optimized audio loading and caching
 */

// Audio configuration constants
export const AUDIO_CONFIG = {
  masterVolume: 0.7,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  fadeInDuration: 1000,
  fadeOutDuration: 500,
  maxSoundInstances: 8, // Prevent audio spam
  spatialAudioRange: 300, // pixels for distance-based volume
};

// Audio asset keys
export const MUSIC_KEYS = {
  OVERWORLD: 'music_overworld',
  SHOP: 'music_shop',
  COMBAT: 'music_combat',
  CAVE: 'music_cave',
  MENU: 'music_menu'
};

export const SFX_KEYS = {
  PLAYER_WALK: 'sfx_walk',
  PLAYER_SWING: 'sfx_swing', 
  PLAYER_HIT: 'sfx_player_hit',
  PLAYER_SHIELD_BLOCK: 'sfx_shield_block',
  ENEMY_HIT: 'sfx_enemy_hit',
  ENEMY_DEATH: 'sfx_enemy_death',
  PICKUP_COIN: 'sfx_pickup_coin',
  PICKUP_ITEM: 'sfx_pickup_item',
  DOOR_OPEN: 'sfx_door_open',
  SHOP_BUY: 'sfx_shop_buy',
  MENU_SELECT: 'sfx_menu_select',
  MENU_BACK: 'sfx_menu_back',
  AMBIENT_WIND: 'sfx_ambient_wind',
  AMBIENT_BIRDS: 'sfx_ambient_birds'
};

/**
 * Audio Manager Class
 * Handles all audio operations for the game
 */
export class AudioManager {
  constructor(scene) {
    this.scene = scene;
    this.currentMusic = null;
    this.musicTween = null;
    this.soundInstances = new Map(); // Track active sounds for limiting
    this.isEnabled = true;
    this.volumes = { ...AUDIO_CONFIG };
    
    // Load audio preferences from localStorage
    this.loadSettings();
  }

  /**
   * Initialize audio assets - call from scene preload
   */
  static preloadAudio(scene) {
    // For now, we'll create procedural audio since we don't have audio files
    // In production, you'd load: scene.load.audio(key, path);
    
    // Placeholder - we'll generate simple tones
    console.log('AudioManager: Preloading procedural audio assets');
  }

  /**
   * Create procedural audio assets - call from scene create
   */
  createAudio() {
    // Generate simple procedural sounds using Web Audio API
    this.createProceduralSounds();
  }

  /**
   * Generate simple procedural sounds for prototyping
   */
  createProceduralSounds() {
    try {
      // Create basic tones for different actions
      const audioContext = this.scene.sound.context;
      if (!audioContext) return;

      // For each sound effect, we'll create a simple tone
      // This is a minimal implementation - real games would use actual audio files
      Object.values(SFX_KEYS).forEach(key => {
        // Create a minimal sound buffer for each effect
        // In production, replace with actual audio file loading
      });

      console.log('AudioManager: Procedural sounds created');
    } catch (error) {
      console.warn('AudioManager: Failed to create procedural sounds:', error);
      this.isEnabled = false;
    }
  }

  /**
   * Play background music with smooth transitions
   */
  playMusic(musicKey, options = {}) {
    if (!this.isEnabled) return;

    const {
      loop = true,
      volume = this.volumes.musicVolume,
      fadeIn = true
    } = options;

    // Stop current music if different
    if (this.currentMusic && this.currentMusic.key !== musicKey) {
      this.stopMusic();
    }

    // Don't restart the same music
    if (this.currentMusic && this.currentMusic.key === musicKey && this.currentMusic.isPlaying) {
      return;
    }

    try {
      // For now, use a placeholder approach since we don't have actual music files
      console.log(`AudioManager: Playing music - ${musicKey}`);
      
      // In a real implementation:
      // this.currentMusic = this.scene.sound.add(musicKey, { loop, volume: fadeIn ? 0 : volume });
      // this.currentMusic.play();
      
      // Store reference for management
      this.currentMusic = { key: musicKey, isPlaying: true };

      // Fade in effect would go here
      if (fadeIn) {
        this.fadeInMusic(volume);
      }

    } catch (error) {
      console.warn(`AudioManager: Failed to play music ${musicKey}:`, error);
    }
  }

  /**
   * Stop current music with fade out
   */
  stopMusic(fadeOut = true) {
    if (!this.currentMusic) return;

    if (fadeOut) {
      this.fadeOutMusic(() => {
        this.currentMusic = null;
      });
    } else {
      // Immediate stop
      console.log('AudioManager: Stopping music immediately');
      this.currentMusic = null;
    }
  }

  /**
   * Fade in music volume
   */
  fadeInMusic(targetVolume) {
    if (this.musicTween) this.musicTween.stop();
    
    // Placeholder for fade in logic
    console.log(`AudioManager: Fading in music to volume ${targetVolume}`);
    
    // In real implementation:
    // this.musicTween = this.scene.tweens.add({
    //   targets: this.currentMusic,
    //   volume: targetVolume,
    //   duration: this.volumes.fadeInDuration,
    //   ease: 'Power2'
    // });
  }

  /**
   * Fade out music volume
   */
  fadeOutMusic(onComplete) {
    if (this.musicTween) this.musicTween.stop();
    
    console.log('AudioManager: Fading out music');
    
    // Simulate fade out delay
    setTimeout(() => {
      if (onComplete) onComplete();
    }, this.volumes.fadeOutDuration);

    // In real implementation:
    // this.musicTween = this.scene.tweens.add({
    //   targets: this.currentMusic,
    //   volume: 0,
    //   duration: this.volumes.fadeOutDuration,
    //   ease: 'Power2',
    //   onComplete: () => {
    //     if (this.currentMusic) {
    //       this.currentMusic.stop();
    //     }
    //     if (onComplete) onComplete();
    //   }
    // });
  }

  /**
   * Play sound effect with optional spatial audio
   */
  playSFX(sfxKey, options = {}) {
    if (!this.isEnabled) return null;

    const {
      volume = this.volumes.sfxVolume,
      x = null,
      y = null,
      playlistenerX = null,
      playerY = null,
      loop = false,
      rate = 1
    } = options;

    // Check instance limits to prevent audio spam
    const instanceCount = this.soundInstances.get(sfxKey) || 0;
    if (instanceCount >= this.volumes.maxSoundInstances) {
      return null;
    }

    try {
      let adjustedVolume = volume;

      // Apply spatial audio if positions provided
      if (x !== null && y !== null && playlistenerX !== null && playerY !== null) {
        adjustedVolume = this.calculateSpatialVolume(x, y, playlistenerX, playerY, volume);
        if (adjustedVolume <= 0) return null; // Too far away
      }

      // For now, just log the sound effect
      console.log(`AudioManager: Playing SFX - ${sfxKey} (volume: ${adjustedVolume.toFixed(2)})`);

      // Track instances
      this.soundInstances.set(sfxKey, instanceCount + 1);

      // Simulate sound duration and cleanup
      setTimeout(() => {
        const currentCount = this.soundInstances.get(sfxKey) || 0;
        this.soundInstances.set(sfxKey, Math.max(0, currentCount - 1));
      }, 1000); // Assume 1 second average sound duration

      // In real implementation:
      // const sound = this.scene.sound.add(sfxKey, { volume: adjustedVolume, loop, rate });
      // sound.play();
      // return sound;

      return { key: sfxKey }; // Placeholder return

    } catch (error) {
      console.warn(`AudioManager: Failed to play SFX ${sfxKey}:`, error);
      return null;
    }
  }

  /**
   * Calculate volume based on distance for spatial audio
   */
  calculateSpatialVolume(soundX, soundY, listenerX, listenerY, baseVolume) {
    const distance = Math.sqrt(
      Math.pow(soundX - listenerX, 2) + Math.pow(soundY - listenerY, 2)
    );

    if (distance >= this.volumes.spatialAudioRange) {
      return 0;
    }

    // Linear falloff - could use exponential for more realistic audio
    const falloff = 1 - (distance / this.volumes.spatialAudioRange);
    return baseVolume * falloff;
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume) {
    this.volumes.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    
    // Update all active audio
    this.updateAllVolumes();
  }

  /**
   * Set music volume
   */
  setMusicVolume(volume) {
    this.volumes.musicVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
    
    if (this.currentMusic) {
      // Update current music volume
      console.log(`AudioManager: Updated music volume to ${volume}`);
    }
  }

  /**
   * Set SFX volume
   */
  setSFXVolume(volume) {
    this.volumes.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Update all active audio volumes
   */
  updateAllVolumes() {
    // Apply master volume to current music
    if (this.currentMusic) {
      const finalMusicVolume = this.volumes.musicVolume * this.volumes.masterVolume;
      console.log(`AudioManager: Updated all volumes (music: ${finalMusicVolume})`);
    }
  }

  /**
   * Toggle audio on/off
   */
  toggleAudio() {
    this.isEnabled = !this.isEnabled;
    
    if (!this.isEnabled) {
      this.stopMusic(false);
    }
    
    this.saveSettings();
    console.log(`AudioManager: Audio ${this.isEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Save audio settings to localStorage
   */
  saveSettings() {
    try {
      const settings = {
        masterVolume: this.volumes.masterVolume,
        musicVolume: this.volumes.musicVolume,
        sfxVolume: this.volumes.sfxVolume,
        enabled: this.isEnabled
      };
      localStorage.setItem('goldHunter_audioSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('AudioManager: Failed to save settings:', error);
    }
  }

  /**
   * Load audio settings from localStorage
   */
  loadSettings() {
    try {
      const saved = localStorage.getItem('goldHunter_audioSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        this.volumes.masterVolume = settings.masterVolume ?? this.volumes.masterVolume;
        this.volumes.musicVolume = settings.musicVolume ?? this.volumes.musicVolume;
        this.volumes.sfxVolume = settings.sfxVolume ?? this.volumes.sfxVolume;
        this.isEnabled = settings.enabled ?? this.isEnabled;
      }
    } catch (error) {
      console.warn('AudioManager: Failed to load settings:', error);
    }
  }

  /**
   * Clean up audio resources
   */
  destroy() {
    this.stopMusic(false);
    if (this.musicTween) {
      this.musicTween.stop();
      this.musicTween = null;
    }
    this.soundInstances.clear();
    this.currentMusic = null;
  }
}

/**
 * Convenience functions for common audio operations
 */

// Quick access functions for main scene
export function playMusic(scene, musicKey, options) {
  if (scene.audioManager) {
    scene.audioManager.playMusic(musicKey, options);
  }
}

export function playSFX(scene, sfxKey, options) {
  if (scene.audioManager) {
    return scene.audioManager.playSFX(sfxKey, options);
  }
  return null;
}

export function stopMusic(scene, fadeOut = true) {
  if (scene.audioManager) {
    scene.audioManager.stopMusic(fadeOut);
  }
}

// Spatial audio helpers
export function playSpatialSFX(scene, sfxKey, soundX, soundY, options = {}) {
  if (!scene.audioManager || !scene.player) return null;
  
  return scene.audioManager.playSFX(sfxKey, {
    ...options,
    x: soundX,
    y: soundY,
    playlistenerX: scene.player.x,
    playerY: scene.player.y
  });
}

// Common game audio events
export function playPlayerAction(scene, actionType) {
  const soundMap = {
    swing: SFX_KEYS.PLAYER_SWING,
    hit: SFX_KEYS.PLAYER_HIT,
    shield: SFX_KEYS.PLAYER_SHIELD_BLOCK,
    walk: SFX_KEYS.PLAYER_WALK
  };
  
  const sfxKey = soundMap[actionType];
  if (sfxKey) {
    playSFX(scene, sfxKey);
  }
}

export function playEnemyAction(scene, enemySprite, actionType) {
  if (!enemySprite) return;
  
  const soundMap = {
    hit: SFX_KEYS.ENEMY_HIT,
    death: SFX_KEYS.ENEMY_DEATH
  };
  
  const sfxKey = soundMap[actionType];
  if (sfxKey) {
    playSpatialSFX(scene, sfxKey, enemySprite.x, enemySprite.y);
  }
}

export function playPickupSound(scene, pickupX, pickupY, itemType) {
  const sfxKey = itemType === 'currency' ? SFX_KEYS.PICKUP_COIN : SFX_KEYS.PICKUP_ITEM;
  playSpatialSFX(scene, sfxKey, pickupX, pickupY);
}

export function playUISound(scene, uiAction) {
  const soundMap = {
    select: SFX_KEYS.MENU_SELECT,
    back: SFX_KEYS.MENU_BACK,
    buy: SFX_KEYS.SHOP_BUY
  };
  
  const sfxKey = soundMap[uiAction];
  if (sfxKey) {
    playSFX(scene, sfxKey);
  }
}