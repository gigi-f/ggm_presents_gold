/*
 AI-INDEX
 - Tags: engine.scenes, mechanics.inventory, mechanics.combat, mechanics.economy
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';
import wolfPng from '../assets/sprites/wolf_small.png';
import prospectorDownPng from '../assets/sprites/prospector_down.png';
import prospectorLeftPng from '../assets/sprites/prospector_left.png';
import prospectorRightPng from '../assets/sprites/prospector_right.png';
import prospectorUpPng from '../assets/sprites/prospector_up.png';
import { MAP_IDS, DOOR_IDS, SCENES } from './lib/constants';
import { getBiomeForMap } from './lib/biomes';
import * as World from './lib/world';
import { beginTransition, endTransition, scrollTransitionToMap as scrollXfer } from './lib/transitions';
import * as Inventory from './lib/inventory.js';
import * as Combat from './lib/combat.js';
import { initWallet, addToWallet, spendFromWallet, getItemPrice, getWalletTotal } from './lib/economy';
// Using PNG sprites for the prospector in four directions
import { updateEnemies } from './lib/enemies';
import { createModal, addTitle, UI as UIRegistry } from './lib/ui';
import * as RexUI from './ui/rex';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    // World sizing
    this.gridCellSize = 16;
    this.worldPixelWidth = 384;   // 24 cells
    this.worldPixelHeight = 288;  // 18 cells
    this.hudHeight = 64;          // HUD band height
  this.edgeGapRadius = 0;       // entrance half-width in tiles (tighten passages)
    // Visual scale for player sprite (keep physics body at grid size)
    this.playerDisplayScale = 1.5;

  // State flags
    this.currentMap = MAP_IDS.OVERWORLD_01;
    this.transitionLock = false;
    this.isScrolling = false;
    this.worldLayer = null;
  this.isPausedOverlay = false;
    this.devFlags = { useRexUI: true };
    // Debug overlays
    this.collisionDebugVisible = false;
    this.collisionDebugGfx = null;

    // Player/inventory default state
    this.player = null;
    this.shieldRaised = false;
    this.shieldKey = null;
    this.shieldSprite = null;
    this.hasShield = false;
    this.shield = null;
    this.shieldType = 'basic';
    this.shieldName = 'None';
    this.inventoryItems = [];
    this.inventorySelected = 0;
    this.inventoryOpen = false;
    this.inventoryPanel = null;
    this.inventoryKey = null;
    this.maxInventorySize = 8;
    this.equippedWeapon = null;
    this.equippedShield = null;
    this.hudWeaponIcon = null;
    this.hudEmptyIcon = null;
    this.lastHudState = null;
    this.lastDirection = 'right';
    this.hasMeleeWeapon = false;
    this.meleeWeapon = null;
    this.meleeWeaponType = 'basic';
    this.meleeWeaponName = 'None';
    this.meleeWeaponAttack = null;
    this.meleeWeaponKey = null;
    this.debugText = null;
    this.meleeWeaponSwingAngle = 0;
    this.meleeWeaponSwinging = false;
    this.meleeWeaponSprite = null;
    this.health = 100;
    this.maxHealth = 100;
  // Gold ingots (win condition)
  this.goldIngotsCount = 0;
  this.goldGoal = 11;
  this.collectedGoldIds = new Set();
  // Stamina system
  this.stamina = 100;
  this.maxStamina = 100;
  this.staminaRegenPerSec = 20; // points per second when not drained
  this._lastStamina = this.stamina;
  // Mini-map overlay (non-blocking)
  this.miniMapVisible = true;
  this.miniMapContainer = null;
  this.miniMapCfg = { width: 100, margin: 6 };
  this._miniMapLastMap = null;
    // World map (visited tiles)
    this.visitedMaps = new Set();
    this.worldMapVisible = false;
    this.worldMapContainer = null;
    this.worldMapLayout = {
      [MAP_IDS.OVERWORLD_00]: { gx: 0, gy: 0, type: 'overworld' },
      [MAP_IDS.OVERWORLD_01]: { gx: 0, gy: 1, type: 'overworld' },
      [MAP_IDS.OVERWORLD_02]: { gx: 1, gy: 1, type: 'overworld' },
      [MAP_IDS.OVERWORLD_03]: { gx: 0, gy: 2, type: 'overworld' },
      [MAP_IDS.SHOP_01]:      { gx: 1, gy: 2, type: 'shop' }
    };

    // Map graph
    this.maps = {
      [MAP_IDS.OVERWORLD_00]: {
        type: 'overworld',
        color: 0x2e7d32, // forest green
        exits: { down: MAP_IDS.OVERWORLD_01 },
        doors: {
          [DOOR_IDS.SOUTH_ENTRY_A]: { targetMap: MAP_IDS.OVERWORLD_01, targetDoor: DOOR_IDS.NORTH_EXIT_A }
        }
      },
      [MAP_IDS.OVERWORLD_01]: {
        type: 'overworld',
        color: 0x66bb6a, // plains green
        exits: { right: MAP_IDS.OVERWORLD_02, up: MAP_IDS.OVERWORLD_00, down: MAP_IDS.OVERWORLD_03 },
        doors: {
          [DOOR_IDS.SHOP_DOOR_01]: { targetMap: MAP_IDS.SHOP_01, targetDoor: DOOR_IDS.SHOP_EXIT_01 },
          [DOOR_IDS.EAST_EXIT_A]: { targetMap: MAP_IDS.OVERWORLD_02, targetDoor: DOOR_IDS.WEST_ENTRY_A },
          [DOOR_IDS.EAST_EXIT_B]: { targetMap: MAP_IDS.OVERWORLD_02, targetDoor: DOOR_IDS.WEST_ENTRY_B },
          [DOOR_IDS.NORTH_EXIT_A]: { targetMap: MAP_IDS.OVERWORLD_00, targetDoor: DOOR_IDS.SOUTH_ENTRY_A },
          [DOOR_IDS.SOUTH_EXIT_A]: { targetMap: MAP_IDS.OVERWORLD_03, targetDoor: DOOR_IDS.NORTH_ENTRY_A }
        }
      },
      [MAP_IDS.OVERWORLD_03]: {
        type: 'overworld',
        color: 0x88cc77, // slightly different plains hue
        exits: { up: MAP_IDS.OVERWORLD_01 },
        doors: {
          [DOOR_IDS.NORTH_ENTRY_A]: { targetMap: MAP_IDS.OVERWORLD_01, targetDoor: DOOR_IDS.SOUTH_EXIT_A }
        }
      },
      [MAP_IDS.OVERWORLD_02]: {
        type: 'overworld',
        color: 0xD2B48C, // desert beige
        exits: { left: MAP_IDS.OVERWORLD_01 },
        doors: {
          [DOOR_IDS.WEST_ENTRY_A]: { targetMap: MAP_IDS.OVERWORLD_01, targetDoor: DOOR_IDS.EAST_EXIT_A },
          [DOOR_IDS.WEST_ENTRY_B]: { targetMap: MAP_IDS.OVERWORLD_01, targetDoor: DOOR_IDS.EAST_EXIT_B }
        }
      },
      [MAP_IDS.SHOP_01]: {
        type: 'shop',
        color: 0x8b5a2b,
        exits: {},
        doors: {
          [DOOR_IDS.SHOP_EXIT_01]: { targetMap: MAP_IDS.OVERWORLD_01, targetDoor: DOOR_IDS.SHOP_DOOR_01 }
        }
      }
    };

    // Door registry
    this.doorRegistry = {
      [MAP_IDS.OVERWORLD_00]: {
        [DOOR_IDS.SOUTH_ENTRY_A]: { gridX: 12, gridY: 17, type: 'edge_south', entranceHalfWidth: 1 }
      },
      [MAP_IDS.OVERWORLD_01]: {
        [DOOR_IDS.SHOP_DOOR_01]: { gridX: 4, gridY: 8, type: 'building_entrance' },
        [DOOR_IDS.EAST_EXIT_A]: { gridX: 19, gridY: 5, type: 'edge_east', entranceHalfWidth: 0 },
        [DOOR_IDS.EAST_EXIT_B]: { gridX: 19, gridY: 10, type: 'edge_east', entranceHalfWidth: 1 },
        [DOOR_IDS.NORTH_EXIT_A]: { gridX: 12, gridY: 0, type: 'edge_north', entranceHalfWidth: 2 },
        [DOOR_IDS.SOUTH_EXIT_A]: { gridX: 12, gridY: 17, type: 'edge_south', entranceHalfWidth: 1 }
      },
      [MAP_IDS.OVERWORLD_03]: {
        [DOOR_IDS.NORTH_ENTRY_A]: { gridX: 12, gridY: 0, type: 'edge_north', entranceHalfWidth: 1 }
      },
      [MAP_IDS.SHOP_01]: {
        [DOOR_IDS.SHOP_EXIT_01]: { gridX: 10, gridY: 16, type: 'building_exit' }
      },
      [MAP_IDS.OVERWORLD_02]: {
        [DOOR_IDS.WEST_ENTRY_A]: { gridX: 0, gridY: 5, type: 'edge_west', entranceHalfWidth: 0 },
        [DOOR_IDS.WEST_ENTRY_B]: { gridX: 0, gridY: 10, type: 'edge_west', entranceHalfWidth: 1 }
      }
    };

    this.activeDoors = {};
    this.collectedItems = {
      meleeWeapon1: false,
      meleeWeapon2: false,
      meleeWeapon3: false,
      shield1: false,
      shield2: false,
      shield3: false,
      healthPotion1: false,
      healthPotion2: false,
      staminaTonic1: false
    };
  }

    // Grid-based placement system for environment objects
    initializeGrid() { World.initializeGrid(this); }

    // Returns true if the index lies within any gap defined by skipSet with the configured radius
    isInEdgeGap(index, skipSet) { return World.isInEdgeGap(this, index, skipSet); }

    isGridCellAvailable(gridX, gridY) { return World.isGridCellAvailable(this, gridX, gridY); }

    occupyGridCell(gridX, gridY) { return World.occupyGridCell(this, gridX, gridY); }

    gridToWorld(gridX, gridY) { return World.gridToWorld(this, gridX, gridY); }

    worldToGrid(worldX, worldY) { return World.worldToGrid(this, worldX, worldY); }

    placeObjectOnGrid(gridX, gridY, objectType, addToGroup = null, extraData = {}) { return World.placeObjectOnGrid(this, gridX, gridY, objectType, addToGroup, extraData); }

    // Create a composite Door as a Container that owns its parts
    createDoorContainer(worldX, worldY, kind = 'entrance', meta = {}) { return World.createDoorContainer(this, worldX, worldY, kind, meta); }

    createGridVisualization() { return World.createGridVisualization(this); }

    toggleGridVisibility() { return World.toggleGridVisibility(this); }

    createMapObjects(options = {}) { return World.createMapObjects(this, options); }

    createDoorsForMap() { return World.createDoorsForMap(this); }

    createShopBuilding(doorGridX, doorGridY) { return World.createShopBuilding(this, doorGridX, doorGridY); }

    enterBuilding(player, doorObj) {
      if (this.transitionLock) return;
      const container = doorObj.ownerContainer || doorObj.parentContainer || doorObj;
      const doorId = container.doorId || doorObj.doorId;
      const targetInfo = this.maps[this.currentMap].doors[doorId];
      if (targetInfo) {
        console.log(`Entering building via door ${doorId}`);
        const targetDoorData = this.doorRegistry[targetInfo.targetMap][targetInfo.targetDoor];
        this.transitionToMapWithLock(targetInfo.targetMap, 
          targetDoorData.gridX * 16 + 8, 
          (targetDoorData.gridY - 3) * 16 + 8); // Position player north of exit door (inside building)
      }
    }

    exitBuilding(player, doorObj) {
      if (this.transitionLock) return;
      const container = doorObj.ownerContainer || doorObj.parentContainer || doorObj;
      const doorId = container.doorId || doorObj.doorId;
      const targetInfo = this.maps[this.currentMap].doors[doorId];
      if (targetInfo) {
        console.log(`Exiting building via door ${doorId}`);
        const targetDoorData = this.doorRegistry[targetInfo.targetMap][targetInfo.targetDoor];
        this.transitionToMapWithLock(targetInfo.targetMap, 
          targetDoorData.gridX * 16 + 8, 
          (targetDoorData.gridY + 2) * 16 + 8); // Position player south of entrance door (outside building)
      }
    }

  handleEdgeExit(player, sensor) {
      // Do not re-trigger during a transition or while scrolling
      if (this.transitionLock || this.isScrolling) return;

      const doorId = sensor.doorId;
      const targetInfo = this.maps[this.currentMap].doors[doorId];
      if (targetInfo) {
        const targetDoorData = this.doorRegistry[targetInfo.targetMap][targetInfo.targetDoor];
        const cs = this.gridCellSize;
        const W = this.worldPixelWidth;
        const H = this.worldPixelHeight;
        // Derive direction from the source door (the one we touched in the current map)
        const sourceDoorData = this.doorRegistry[this.currentMap]?.[doorId];
        const dirMap = {
          'edge_east': 'right',
          'edge_west': 'left',
          'edge_north': 'up',
          'edge_south': 'down'
        };
        const direction = sourceDoorData ? dirMap[sourceDoorData.type] : null;
        // Compute landing grid cell exactly one tile inside the target edge, aligned to the entrance span
        const Wg = Math.floor(W / cs), Hg = Math.floor(H / cs);
        const maxGX = Wg - 1, maxGY = Hg - 1;
        const mapType = this.maps?.[targetInfo.targetMap]?.type;
        const baseHalf = () => {
          const raw = Number.isFinite(targetDoorData?.entranceHalfWidth)
            ? Math.floor(targetDoorData.entranceHalfWidth)
            : Math.floor(this.edgeGapRadius ?? 0);
          const minHalf = (mapType === 'overworld') ? 1 : 0;
          return Math.max(minHalf, Math.max(0, raw));
        };
        const half = baseHalf();
        // Player's current grid indices
        const pGX = Math.floor(this.player.x / cs);
        const pGY = Math.floor(this.player.y / cs);
        let gx = pGX, gy = pGY;
        if (direction === 'right' || targetDoorData.type === 'edge_west') {
          gx = 1;
          const gyMin = Math.max(1, (targetDoorData.gridY - half));
          const gyMax = Math.min(maxGY - 1, (targetDoorData.gridY + half));
          gy = Math.min(gyMax, Math.max(gyMin, pGY));
        } else if (direction === 'left' || targetDoorData.type === 'edge_east') {
          gx = maxGX - 1;
          const gyMin = Math.max(1, (targetDoorData.gridY - half));
          const gyMax = Math.min(maxGY - 1, (targetDoorData.gridY + half));
          gy = Math.min(gyMax, Math.max(gyMin, pGY));
        } else if (direction === 'up' || targetDoorData.type === 'edge_south') {
          gy = maxGY - 1;
          const gxMin = Math.max(1, (targetDoorData.gridX - half));
          const gxMax = Math.min(maxGX - 1, (targetDoorData.gridX + half));
          gx = Math.min(gxMax, Math.max(gxMin, pGX));
        } else if (direction === 'down' || targetDoorData.type === 'edge_north') {
          gy = 1;
          const gxMin = Math.max(1, (targetDoorData.gridX - half));
          const gxMax = Math.min(maxGX - 1, (targetDoorData.gridX + half));
          gx = Math.min(gxMax, Math.max(gxMin, pGX));
        }
        const wp = this.gridToWorld(gx, gy);

        if (this.maps[this.currentMap]?.type === 'overworld' && direction) {
          // Smooth scroll to exact landing cell in the target map
          this.scrollTransitionToMap(direction, targetInfo.targetMap, wp.x, wp.y);
        } else {
          this.transitionToMapWithLock(targetInfo.targetMap, wp.x, wp.y);
        }
      }
    }

    transitionToMapWithLock(newMapId, playerX, playerY) {
      this.transitionLock = true;
      this.transitionToMap(newMapId, playerX, playerY);
      this.time.delayedCall(180, () => {
        this.transitionLock = false;
      });
    }

    // Smooth camera scroll transition when moving between adjacent overworld tiles
  scrollTransitionToMap(direction, newMapId, playerX, playerY) {
      // Pre-mark target as visited so overworld map reveals upon arrival
      try { this.visitedMaps.add(newMapId); } catch {}
      scrollXfer(this, direction, newMapId, playerX, playerY);
    }

    // Centralize locking and input/physics freeze during transitions
    beginTransition() { beginTransition(this); }

    // Centralize unlock and key reset after transitions
    endTransition() { endTransition(this); }

    takeDamage(amount) {
      this.health = Math.max(0, this.health - amount);
      // Update the UI Scene's health bar
  this.scene.get(SCENES.UI).updateHealthBar(this.health, this.maxHealth);
      
      // Flash the player red when taking damage
      // Sprites: use tint; Shapes: use fill color
      if (typeof this.player.setTint === 'function') {
        const originalTint = this.player.tintTopLeft;
        this.player.setTint(0xff0000);
        this.time.delayedCall(200, () => {
          if (this.player && typeof this.player.clearTint === 'function') this.player.clearTint();
          else if (this.player && typeof this.player.setTint === 'function') this.player.setTint(originalTint);
        });
      } else if (typeof this.player.setFillStyle === 'function') {
        const originalColor = this.player.fillColor;
        this.player.setFillStyle(0xff0000);
        this.time.delayedCall(200, () => {
          if (this.player && typeof this.player.setFillStyle === 'function') this.player.setFillStyle(originalColor);
        });
      }
      
      // Check for death
      if (this.health <= 0) {
        // Handle player death here
        console.log('Player died!');
      }
    }

    pickupMeleeWeapon(player, meleeWeapon) {
      const weaponItem = {
        type: 'weapon',
        subtype: meleeWeapon.weaponType,
        name: meleeWeapon.weaponName,
        color: this.getWeaponColor(meleeWeapon.weaponType),
        size: this.getWeaponSize(meleeWeapon.weaponType),
        swingDuration: this.getWeaponSwingDuration(meleeWeapon.weaponType)
      };
      
      if (this.addToInventory(weaponItem)) {
        // Mark item as collected based on which weapon it is
        if (meleeWeapon === this.meleeWeapon1) {
          this.collectedItems.meleeWeapon1 = true;
        } else if (meleeWeapon === this.meleeWeapon2) {
          this.collectedItems.meleeWeapon2 = true;
        } else if (meleeWeapon === this.meleeWeapon3) {
          this.collectedItems.meleeWeapon3 = true;
        }
        
        meleeWeapon.destroy();
        console.log(`Added ${weaponItem.name} to inventory!`);

        // Auto-equip if no weapon equipped yet
        if (!this.equippedWeapon) {
          this.equipWeapon(weaponItem);
          this.updateEquipmentHUD();
        }
      } else {
        console.log('Inventory full! Cannot pick up item.');
      }
    }

    pickupShield(player, shield) {
      const shieldItem = {
        type: 'shield',
        subtype: shield.shieldType,
        name: shield.shieldName,
        color: this.getShieldColor(shield.shieldType),
        size: this.getShieldSize(shield.shieldType)
      };
      
      if (this.addToInventory(shieldItem)) {
        // Mark item as collected based on which shield it is
        if (shield === this.shield1) {
          this.collectedItems.shield1 = true;
        } else if (shield === this.shield2) {
          this.collectedItems.shield2 = true;
        } else if (shield === this.shield3) {
          this.collectedItems.shield3 = true;
        }
        
        shield.destroy();
        console.log(`Added ${shieldItem.name} to inventory!`);

        // Auto-equip if no shield equipped yet
        if (!this.equippedShield) {
          this.equipShield(shieldItem);
          this.updateEquipmentHUD();
        }
      } else {
        console.log('Inventory full! Cannot pick up item.');
      }
    }

    pickupCurrency(player, currencyItem) {
      const type = currencyItem.currencyType || 'copper';
      // Add one unit to the wallet and update HUD via helper
      addToWallet(this, type, 1);
      // Track collected currency by id to prevent respawn
      if (!this.collectedCurrency) this.collectedCurrency = new Set();
      if (currencyItem.currencyId) this.collectedCurrency.add(currencyItem.currencyId);
      currencyItem.destroy();
      console.log(`Picked up ${type} ingot! Total currency: ${this.wallet?.total ?? 0}p`);
    }

    // Gold ingot pickup (not currency). Increments count toward win condition.
    pickupGoldIngot(player, gold) {
      const id = gold.goldId || null;
      if (!this.collectedGoldIds) this.collectedGoldIds = new Set();
      if (id && this.collectedGoldIds.has(id)) { try { gold.destroy(); } catch {} return; }
      this.goldIngotsCount = (this.goldIngotsCount || 0) + 1;
      if (id) this.collectedGoldIds.add(id);
      try { gold.destroy(); } catch {}
      // Update HUD
      try { this.scene.get(SCENES.UI)?.updateGoldIngots?.(this.goldIngotsCount, this.goldGoal); } catch {}
      console.log(`Collected GOLD ingot ${id || ''} -> ${this.goldIngotsCount}/${this.goldGoal}`);
      // Win check
      if (this.goldIngotsCount >= (this.goldGoal || 11)) {
        this.showWinModal?.();
      }
    }

    swingMeleeWeapon() { return Combat.swingMeleeWeapon(this); }

    raiseShield() { return Combat.raiseShield(this); }

    lowerShield() { return Combat.lowerShield(this); }

    updateShieldPosition() { return Combat.updateShieldPosition(this); }

    updateMeleeWeaponPosition() { return Combat.updateMeleeWeaponPosition(this); }

    // Inventory Management Methods
    addToInventory(item) { return Inventory.addToInventory(this, item); }

    removeFromInventory(index) { return Inventory.removeFromInventory(this, index); }

    equipFromInventory(index) { return Inventory.equipFromInventory(this, index); }

    equipWeapon(weaponItem) { return Inventory.equipWeapon(this, weaponItem); }

    equipShield(shieldItem) { return Inventory.equipShield(this, shieldItem); }

    toggleInventory() { return Inventory.toggleInventory(this); }

    showInventory() { return Inventory.showInventory(this); }

    hideInventory() { return Inventory.hideInventory(this); }

    updateInventoryDisplay() { return Inventory.updateInventoryDisplay(this); }

    // Helper methods for item properties
    getWeaponColor(weaponType) {
      switch (weaponType) {
        case 'starter': return 0x666666; // Dark gray
        case 'basic': return 0x888888;
        case 'strong': return 0xFFD700;
        case 'fast': return 0x00FFFF;
        default: return 0x888888;
      }
    }

    getWeaponSize(weaponType) {
      switch (weaponType) {
        case 'starter': return { width: 14, height: 3 }; // Small weak weapon
        case 'basic': return { width: 20, height: 4 };
        case 'strong': return { width: 24, height: 5 };
        case 'fast': return { width: 16, height: 3 };
        default: return { width: 20, height: 4 };
      }
    }

    getWeaponSwingDuration(weaponType) {
      switch (weaponType) {
        case 'starter': return 350; // Slower than basic
        case 'basic': return 200;
        case 'strong': return 250;
        case 'fast': return 150;
        default: return 200;
      }
    }

    getShieldColor(shieldType) {
      switch (shieldType) {
        case 'basic': return 0x654321;
        case 'strong': return 0xC0C0C0;
        case 'light': return 0x4169E1;
        default: return 0x654321;
      }
    }

    getShieldSize(shieldType) {
      switch (shieldType) {
        case 'basic': return { width: 12, height: 16 };
        case 'strong': return { width: 14, height: 18 };
        case 'light': return { width: 10, height: 14 };
        default: return { width: 12, height: 16 };
      }
    }
  
    preload() {
      // Preload enemy sprites so runtime can reference assets directly
      try {
        this.load.image('wolf', wolfPng);
      } catch {}
      // Preload player sprites (prospector facing directions)
      try {
        this.load.image('prospector_down', prospectorDownPng);
        this.load.image('prospector_left', prospectorLeftPng);
        this.load.image('prospector_right', prospectorRightPng);
        this.load.image('prospector_up', prospectorUpPng);
      } catch {}
    }
  
  create() {
      // Initialize wallet/currency tracking early
      initWallet(this);
      // Ensure keyboard input is enabled (in case a prior transition left it disabled)
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = true;
      }

      // Also re-enable on scene wake/resume
      this.events.on('wake', () => {
        if (this.input && this.input.keyboard) this.input.keyboard.enabled = true;
      });
      // Launch UI Scene and wait for it to be ready
      this.scene.launch(SCENES.UI);
          this.scene.get(SCENES.UI).events.once('create', () => {
            this.scene.get(SCENES.UI).updateHealthBar(this.health, this.maxHealth);
            // Initialize currency HUD from wallet
            const w = this.wallet || { total: 0, counts: { copper: 0, silver: 0 } };
            this.scene.get(SCENES.UI).updateCurrency(w.total || 0, w.counts.copper || 0, w.counts.silver || 0);
              if (this.scene.get(SCENES.UI).updateStaminaBar) {
                this.scene.get(SCENES.UI).updateStaminaBar(this.stamina, this.maxStamina);
              }
            // Initialize gold ingot HUD
            this.scene.get(SCENES.UI).updateGoldIngots?.(this.goldIngotsCount || 0, this.goldGoal || 11);
            // Initialize biome label
            try { this.scene.get(SCENES.UI).updateBiome?.(getBiomeForMap(this, this.currentMap)); } catch {}
        
        // Use a small delay to ensure UI is fully ready before equipping and updating
        this.time.delayedCall(50, () => {
          // Equip default starter weapon after UI is ready
          this.equipDefaultWeapon();
          
          // Force update the equipment HUD after a brief delay
          this.time.delayedCall(10, () => {
            this.updateEquipmentHUD();
          });
        });
      });

  // Provide a simple bound shim so dialog can call spend regardless of import order
  this._spendFromWalletShim = (cost) => spendFromWallet(this, cost);

      // Pre-warm the physics system
      this.physics.world.fixedStep = true;
      this.physics.world.fps = 60;

      // Initialize all keyboard inputs
      this.keys = {
        inventory: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
        meleeWeapon: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
        shield: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
        action: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
        left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
        damage: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H), // Debug key for damage
        gridToggle: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P) // Debug key for grid
      };

      // Set up keyboard event listeners for immediate response
      this.input.keyboard.on('keydown-Z', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('Z key pressed - attempting melee weapon attack');
        this.swingMeleeWeapon();
      });

      this.input.keyboard.on('keydown-X', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('X key pressed - attempting shield raise');
        if (!this.shieldRaised) {
          this.raiseShield();
        }
      });

      this.input.keyboard.on('keyup-X', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('X key released - lowering shield');
        if (this.shieldRaised) {
          this.lowerShield();
        }
      });

      // Removed: keyup-Z lowering shield to avoid conflicting with melee key

      this.input.keyboard.on('keydown-H', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('H key pressed - taking debug damage');
        this.takeDamage(10);
      });

      this.input.keyboard.on('keydown-I', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        const names = (UIRegistry.names && UIRegistry.names()) || [];
        if (this.isScrolling) return;
        // Permit toggling inventory if it's the only/toplevel open UI
        if (UIRegistry.anyOpen() && !names.includes('inventory')) {
          console.log('Inventory blocked while another UI dialog is active');
          return;
        }
        console.log('I key pressed - toggling inventory');
        this.toggleInventory();
      });

      this.input.keyboard.on('keydown-P', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('P key pressed - toggling grid and physics-body overlay');
        this.toggleGridVisibility();
        this.toggleCollisionDebug();
      });

      // Mini-map toggle (non-modal HUD overlay)
      this.input.keyboard.on('keydown-M', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        this.toggleMiniMap();
      });

      // Overworld Map overlay (visited tiles only)
      this.input.keyboard.on('keydown-O', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        this.toggleWorldMap();
      });

      // Global Pause toggle with Escape (when no other UI is active)
      this.input.keyboard.on('keydown-ESC', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        const names = (UIRegistry.names && UIRegistry.names()) || [];
        // Prioritize closing top-most modal UIs with ESC
  if (names.includes('shop')) { this.closeShopDialog(); return; }
  if (names.includes('inventory')) { this.hideInventory(); this.inventoryOpen = false; return; }
        if (names.includes('worldmap')) { this.closeWorldMap?.(); return; }
        // If some other UI is open that's not pause, ignore here
        if (names.length > 0 && !names.includes('pause')) return;
        // Toggle pause
        if (names.includes('pause')) this.closePauseMenu();
        else this.openPauseMenu();
      });

      this.input.keyboard.on('keydown-C', (event) => {
        const names = (UIRegistry.names && UIRegistry.names()) || [];
        // If inventory UI is open, let its own key handler process 'C' (submenu/inspect/etc.)
        if (names.includes('inventory')) return; // do not prevent default; allow propagation
        // If any other modal UI is open, ignore interact key to avoid conflicts
        if (UIRegistry.anyOpen()) return;
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        this.tryInteract();
      });

      this.input.keyboard.on('keydown-ONE', () => {
        this.equipFromInventory(0);
      });

      this.input.keyboard.on('keydown-TWO', () => {
        this.equipFromInventory(1);
      });

      this.input.keyboard.on('keydown-THREE', () => {
        this.equipFromInventory(2);
      });

      this.input.keyboard.on('keydown-FOUR', () => {
        this.equipFromInventory(3);
      });

      this.input.keyboard.on('keydown-FIVE', () => {
        this.equipFromInventory(4);
      });

      this.input.keyboard.on('keydown-SIX', () => {
        this.equipFromInventory(5);
      });

      this.input.keyboard.on('keydown-SEVEN', () => {
        this.equipFromInventory(6);
      });

      this.input.keyboard.on('keydown-EIGHT', () => {
        this.equipFromInventory(7);
      });

  // Set up the game world
  // Resize camera to account for larger world and HUD band on top
  this.cameras.main.setViewport(0, this.hudHeight, this.worldPixelWidth, this.worldPixelHeight);
  this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
  // Create player as a physics-enabled sprite using the PNG prospector texture
        const initialPlayerTexKey = 'prospector_down';
  this.player = this.physics.add.sprite(this.worldPixelWidth/2, this.worldPixelHeight/2, initialPlayerTexKey);
      this.player.setDepth(1); // Put player above ground objects
      // Player should be exactly 1x1 grid cell in size (display and collision)
      const cs = this.gridCellSize;
      try { this.player.setDisplaySize(cs * this.playerDisplayScale, cs * this.playerDisplayScale); } catch {}
      if (this.player.body && this.player.body.setSize) {
        // Center the body on the sprite using the 'center' flag
        this.player.body.setSize(cs, cs, true);
      }

            // Quantize player spawn to nearest interior grid tile center
            try { World.quantizeObjectToGrid(this, this.player, { interior: true }); } catch {}

      // Initialize grid system for object placement
      this.initializeGrid();

      // Create boundary rocks and map-specific objects
      this.createMapObjects();
      // Mark initial map as visited for world map fog-of-war
      try { this.visitedMaps.add(this.currentMap); } catch {}

      // Pre-warm the physics/renderer by doing a quick step
      this.time.delayedCall(16, () => {
        this.physics.world.step(16);
      });

    }

    equipDefaultWeapon() { return Inventory.equipDefaultWeapon(this); }

    updateEquipmentHUD() { return Inventory.updateEquipmentHUD(this); }

    transitionToMap(newMapIndex, playerX, playerY) {
      this.currentMap = newMapIndex;
      // Mark visited
      try { this.visitedMaps.add(this.currentMap); } catch {}
  // Snap landing position to grid, then nudge to nearest free cell to avoid overlapping walls/maze
  const snapped = World.quantizeWorldPosition(this, playerX, playerY, { interior: true });
  const safe = World.findNearestFreeWorldPosition(this, snapped.x, snapped.y);
      this.player.x = safe.x;
      this.player.y = safe.y;
      this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
      this.createMapObjects(); // Recreate boundary rocks and map objects
      // Update biome HUD on map change
      try { this.scene.get(SCENES.UI)?.updateBiome?.(getBiomeForMap(this, this.currentMap)); } catch {}
    }

  update(time, delta) {
      if (!this.player) return;
      // Block movement and map checks while the scroll transition runs or a UI is open
      if (this.isScrolling || UIRegistry.anyOpen()) {
        if (this.player.body) {
          this.player.body.setVelocity(0, 0);
        }
        // When a modal UI is open we normally let enemies settle, but if it's a hard Pause, skip updates entirely.
        const openNames = UIRegistry.names ? UIRegistry.names() : [];
        if (!openNames.includes('pause')) {
          // Still tick enemies so they can settle/return while dialog
          updateEnemies(this, time);
        }
        return;
      }

        // Input is handled via event listeners; avoid duplicating with JustDown/JustUp here to prevent double triggers.
  
      const body = this.player.body;
      const now = this.time?.now ?? 0;
      const knockbackActive = !!this.playerKnockbackUntil && now < this.playerKnockbackUntil;
      if (!knockbackActive) {
        body.setVelocity(0);
      }

      // Handle movement with diagonal normalization (suppressed during hurt knockback)
      if (!knockbackActive) {
        let velocityX = 0;
        let velocityY = 0;
        // Base speed modified by terrain zones
        let speed = 100;
        if (this._terrainSlowUntil && (this.time.now <= this._terrainSlowUntil)) {
          speed = Math.floor((this._terrainSlowFactor || 1) * speed);
        }

        if (this.keys.left.isDown) {
          velocityX = -speed;
          this.lastDirection = 'left';
        } else if (this.keys.right.isDown) {
          velocityX = speed;
          this.lastDirection = 'right';
        }
        
        if (this.keys.up.isDown) {
          velocityY = -speed;
          this.lastDirection = 'up';
        } else if (this.keys.down.isDown) {
          velocityY = speed;
          this.lastDirection = 'down';
        }

        // Normalize diagonal movement to maintain consistent speed
        if (velocityX !== 0 && velocityY !== 0) {
          velocityX *= 0.707; // Math.sqrt(2) / 2 ≈ 0.707
          velocityY *= 0.707;
        }

        body.setVelocity(velocityX, velocityY);

        // Swap player texture based on facing direction
        // Only update when the desired texture differs to avoid redundant setTexture calls
        const desiredKey = (() => {
          switch (this.lastDirection) {
            case 'left': return 'prospector_left';
            case 'up': return 'prospector_up';
            case 'down': return 'prospector_down';
            case 'right':
            default: return 'prospector_right';
          }
        })();
        try {
          const currentKey = this.player?.texture?.key;
          if (currentKey !== desiredKey) {
            this.player.setTexture(desiredKey);
            // Keep the sprite scaled consistently when texture changes
            const cs2 = this.gridCellSize;
            try { this.player.setDisplaySize(cs2 * this.playerDisplayScale, cs2 * this.playerDisplayScale); } catch {}
          }
        } catch {}
      } else {
        // Apply knockback damping so the push tapers off smoothly
        const d = this.playerKnockbackDamping ?? 0.9;
        body.setVelocity(body.velocity.x * d, body.velocity.y * d);
        if (now >= this.playerKnockbackUntil) {
          this.playerKnockbackUntil = 0;
        }
      }

      // Update shield position if shield is raised and player is moving
      if (!knockbackActive) {
        // Update shield position if shield is raised and player is moving
        const vx = body.velocity.x, vy = body.velocity.y;
        if (this.shieldRaised && (vx !== 0 || vy !== 0)) {
          this.updateShieldPosition();
        }
      }
      // Shopkeeper shotgun: show and aim at player while retaliation window is active
      try {
        const now2 = this.time?.now ?? 0;
        const keep = this.shopkeeper;
        const shouldShowGun = keep && keep.active && this.currentMap === MAP_IDS.SHOP_01 && this._shopkeeperGunVisibleUntil && now2 < this._shopkeeperGunVisibleUntil;
        if (shouldShowGun) {
          if (!this._shopkeeperGunSprite || !this._shopkeeperGunSprite.active) {
            // Simple rectangle as shotgun; anchored at keeper hand side
            const w = 18, h = 5;
            this._shopkeeperGunSprite = this.add.rectangle(keep.x, keep.y, w, h, 0x222222).setOrigin(1, -1).setDepth(2);
            if (this.worldLayer) this.worldLayer.add(this._shopkeeperGunSprite);
          }
          // Aim at player
          const dx = this.player.x - keep.x; const dy = this.player.y - keep.y;
          const angle = Math.atan2(dy, dx);
          // Position at shopkeeper edge: offset slightly from center toward facing direction
          const off = 6;
          this._shopkeeperGunSprite.x = keep.x + Math.cos(angle) * off;
          this._shopkeeperGunSprite.y = keep.y + Math.sin(angle) * off;
          this._shopkeeperGunSprite.rotation = angle;
          this._shopkeeperGunSprite.setVisible(true);
        } else if (this._shopkeeperGunSprite) {
          this._shopkeeperGunSprite.setVisible(false);
        }
      } catch {}
  
  // Overworld transitions are handled solely by edge sensors; no boundary-based triggers.
      
      // --- Stamina: regen/drain tick ---
      const dt = (delta || 16) / 1000;
      let staminaChanged = false;
      if (this.shieldRaised) {
        const drain = 10 * dt;
        const prev = this.stamina;
        this.stamina = Math.max(0, this.stamina - drain);
        staminaChanged = staminaChanged || (this.stamina !== prev);
        if (this.stamina <= 0) {
          if (this.shieldRaised) this.lowerShield();
        }
      } else {
        const prev = this.stamina;
        this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenPerSec * dt);
        staminaChanged = staminaChanged || (this.stamina !== prev);
      }
      if (staminaChanged && Math.abs(this.stamina - this._lastStamina) >= 0.5) {
        const ui = this.scene.get(SCENES.UI);
        if (ui && ui.scene.isActive() && ui.updateStaminaBar) {
          ui.updateStaminaBar(Math.round(this.stamina), this.maxStamina);
        }
        this._lastStamina = this.stamina;
      }

      // Enemies update
  updateEnemies(this, time);

      // Mini-map upkeep
      if (this.miniMapVisible) {
        if (this._miniMapLastMap !== this.currentMap) {
          this.refreshMiniMap();
        } else {
          this.updateMiniMapPlayerDot();
        }
        this.updateMiniMapEntities();
      }

      // World map: nothing per-frame except input; kept static while open
      
      // Update interaction prompt visibility if near the shopkeeper
        this.updateInteractionPrompt();
        this.updatePickupPrompt?.();

      // Collision/physics bodies debug overlay
      if (this.collisionDebugVisible) this._redrawCollisionDebugOverlay();
      else if (this.collisionDebugGfx) { try { this.collisionDebugGfx.clear(); } catch {} }
    }

    // Toggle drawing of physics bodies (player + enemies) in red
    toggleCollisionDebug() {
      this.collisionDebugVisible = !this.collisionDebugVisible;
      if (this.collisionDebugVisible) {
        if (!this.collisionDebugGfx) {
          this.collisionDebugGfx = this.add.graphics();
          // Draw above world objects but below UI Scene
          try { this.collisionDebugGfx.setDepth(500); } catch {}
        }
        this.collisionDebugGfx.setVisible(true);
      } else {
        if (this.collisionDebugGfx) {
          try { this.collisionDebugGfx.clear(); this.collisionDebugGfx.setVisible(false); } catch {}
        }
      }
    }

    _redrawCollisionDebugOverlay() {
      const g = this.collisionDebugGfx;
      if (!g) return;
      try { g.clear(); } catch {}
      try { g.lineStyle(1, 0xff0000, 1); } catch {}
      // Player body
      try {
        const pb = this.player?.body;
        if (pb && pb.width && pb.height) {
          g.strokeRect(pb.x, pb.y, pb.width, pb.height);
        }
      } catch {}
      // Enemies bodies
      try {
        const grp = this.enemiesGroup;
        if (grp && grp.getChildren) {
          for (const e of grp.getChildren()) {
            if (!e || !e.active) continue;
            const b = e.body;
            if (b && b.width && b.height) {
              g.strokeRect(b.x, b.y, b.width, b.height);
            }
          }
        }
      } catch {}
    }

    // Simple heal utility used by shop purchases
    heal(amount) {
      this.health = Math.min(this.maxHealth, this.health + amount);
      const ui = this.scene.get(SCENES.UI);
      ui?.updateHealthBar(this.health, this.maxHealth);
    }

    // Check if player near shopkeeper and show/hide prompt
    updateInteractionPrompt() {
      const names = (UIRegistry.names && UIRegistry.names()) || [];
      // Hide prompt if any modal UI is open
      if (UIRegistry.anyOpen()) {
        if (this.interactText) this.interactText.setVisible(false);
        return;
      }
      const inShop = this.currentMap === MAP_IDS.SHOP_01;
      const keep = this.shopkeeper;
      if (!inShop || !keep || !keep.active) {
        if (this.interactText) this.interactText.setVisible(false);
        return;
      }
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, keep.x, keep.y);
      if (d <= 24) {
        if (!this.interactText) {
          this.interactText = this.add.text(keep.x, keep.y - 22, 'Press C to talk', { fontSize: '8px', color: '#ffffaa', backgroundColor: '#00000080' }).setOrigin(0.5, 1).setDepth(200);
          if (this.worldLayer) this.worldLayer.add(this.interactText);
        }
        this.interactText.setVisible(true);
        this.interactText.x = keep.x; this.interactText.y = keep.y - 22;
      } else if (this.interactText) {
        this.interactText.setVisible(false);
      }
    }

    // Show/Hide pickup prompt for dropped items near the player
    updatePickupPrompt() {
      if (UIRegistry.anyOpen()) { if (this.pickupText) this.pickupText.setVisible(false); return; }
      const grp = this.droppedItemsGroup;
      if (!grp) { if (this.pickupText) this.pickupText.setVisible(false); return; }
      const items = grp.getChildren?.() || [];
      let nearest = null, bestD = 9999;
      for (const it of items) {
        if (!it || !it.active) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
        if (d < 18 && d < bestD) { nearest = it; bestD = d; }
      }
      if (nearest) {
        if (!this.pickupText) {
          this.pickupText = this.add.text(this.player.x, this.player.y - 18, 'Press C to pick up', { fontSize: '8px', color: '#ffffaa', backgroundColor: '#00000080' }).setOrigin(0.5, 1).setDepth(200);
          if (this.worldLayer) this.worldLayer.add(this.pickupText);
        }
        this.pickupText.setVisible(true);
        this.pickupText.x = this.player.x; this.pickupText.y = this.player.y - 18;
      } else if (this.pickupText) {
        this.pickupText.setVisible(false);
      }
    }

    tryInteract() {
        // If any UI is open, ignore interactions
        if (this.isScrolling || UIRegistry.anyOpen()) return;
        // Pickup dropped items (if any nearby) with priority over NPC talk
        if (this.droppedItemsGroup) {
          const items = this.droppedItemsGroup.getChildren?.() || [];
          let nearest = null, bestD = 9999;
          for (const it of items) {
            if (!it || !it.active) continue;
            const idist = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
            if (idist < 18 && idist < bestD) { nearest = it; bestD = idist; }
          }
          if (nearest) {
            // Convert dropped object metadata back to inventory item shape and add
            const meta = nearest._invItemSnapshot || {};
            const item = { type: nearest.itemType, subtype: nearest.itemSubtype, name: nearest.itemName, ...meta };
            const ok = this.addToInventory(item);
            if (ok) {
              try { nearest.destroy(); } catch {}
              this.updateInventoryDisplay?.();
              this.showToast?.(`Picked up ${item.name || 'item'}`);
            } else {
              this.showToast?.('Inventory full!');
            }
            return;
          }
        }
        // Shopkeeper interaction if in shop and close enough
        const inShop = this.currentMap === MAP_IDS.SHOP_01;
        const keep = this.shopkeeper;
        if (!inShop || !keep || !keep.active) return;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, keep.x, keep.y);
        if (d > 24) return;
        if (this.interactText) this.interactText.setVisible(false);
        this.openShopDialog();
    }

    openPauseMenu() {
      if (UIRegistry.anyOpen()) {
        const names = UIRegistry.names ? UIRegistry.names() : [];
        if (!names.includes('pause')) return; // don't stack over other UIs
      }
      UIRegistry.open('pause');
      this.isPausedOverlay = true;
      if (this.devFlags?.useRexUI && this.rexUI) {
        this.pauseDialog = RexUI.showPauseMenuRex(this);
        try { this.physics.world.pause(); } catch {}
        try { this.tweens.pauseAll(); } catch {}
        return;
      }
      // Build pause overlay (fallback)
      this.pauseModal = createModal(this, { coverHUD: false, depthBase: 600 });
      this.pauseTitle = addTitle(this, this.pauseModal, 'Paused', { fontSize: '14px', color: '#ffffff' });
      const hint = 'ESC to resume';
      const y = this.pauseModal.content.bottom - 2;
      this.pauseHint = this.add.text(this.pauseModal.center.x, y, hint, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 1).setDepth(602);
      // Buttons: Save, Load, Quit (Quit = just close overlay for now)
      const cx = this.pauseModal.center.x;
      const bx = cx; let by = this.pauseModal.content.top + 28;
      const makeButton = (label, onClick) => {
        const w = 70, h = 14;
        const r = this.add.rectangle(bx, by, w, h, 0x333333, 0.9).setStrokeStyle(1, 0xffffff).setDepth(602).setInteractive({ useHandCursor: true });
        const t = this.add.text(bx, by, label, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5).setDepth(603);
        r.on('pointerdown', () => { onClick(); });
        by += h + 6;
        return [r, t];
      };
      const nodes = [];
      nodes.push(...makeButton('Save', () => this.saveGame()));
      nodes.push(...makeButton('Load', () => this.loadGame()));
      nodes.push(...makeButton('Resume', () => this.closePauseMenu()));
      this.pauseButtons = nodes;
      // Pause physics and tweens
      try { this.physics.world.pause(); } catch {}
      try { this.tweens.pauseAll(); } catch {}
    }

    closePauseMenu() {
      this.isPausedOverlay = false;
      UIRegistry.close('pause');
      // Rex dialog cleanup if used
      if (this.pauseDialog) { try { this.pauseDialog.destroy?.(); } catch {} this.pauseDialog = null; }
      // Destroy nodes
  [this.pauseHint, this.pauseTitle].forEach(n => { try { n?.destroy(); } catch {} });
  if (this.pauseButtons) { this.pauseButtons.forEach(n => { try { n?.destroy(); } catch {} }); this.pauseButtons = null; }
      try { this.pauseModal?.destroy(); } catch {}
      this.pauseHint = this.pauseTitle = this.pauseModal = null;
      // Resume physics and tweens
      try { this.physics.world.resume(); } catch {}
      try { this.tweens.resumeAll(); } catch {}
    }

    // --- World Map (visited tiles only) ---
    toggleWorldMap() { if (this.worldMapVisible) this.closeWorldMap(); else this.openWorldMap(); }
    openWorldMap() {
      if (this.worldMapVisible) return;
      this.worldMapVisible = true;
      UIRegistry.open('worldmap');
      // Ensure current map counted as visited
      try { this.visitedMaps.add(this.currentMap); } catch {}
      this.buildWorldMapContainer();
    }
    closeWorldMap() {
      this.worldMapVisible = false;
      UIRegistry.close('worldmap');
      if (this.worldMapContainer) { try { this.worldMapContainer.destroy(); } catch {} this.worldMapContainer = null; }
    }
    buildWorldMapContainer() {
      if (this.worldMapContainer) { try { this.worldMapContainer.destroy(); } catch {} }
      const modal = createModal(this, { coverHUD: true, depthBase: 620, outerMargin: 10, padTop: 20, padBottom: 18 });
      const title = addTitle(this, modal, 'World Map', { fontSize: '14px', color: '#ffffff' });
      const hint = this.add.text(modal.center.x, modal.content.bottom, 'O to close', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 1).setDepth(623);
      // Compute grid bounds (exclude shop tiles from overworld map)
      const layouts = Object.entries(this.worldMapLayout).filter(([, v]) => v.type !== 'shop');
      // If nothing to draw, just build empty container with modal
      if (layouts.length === 0) {
        this.worldMapContainer = this.add.container(0, 0, [modal.backdrop, modal.panel, title, hint]).setDepth(620);
        this.worldMapContainer.setScrollFactor(0);
        this.worldMapContainer.modal = modal;
        return;
      }
      const minGX = Math.min(...layouts.map(([, v]) => v.gx));
      const maxGX = Math.max(...layouts.map(([, v]) => v.gx));
      const minGY = Math.min(...layouts.map(([, v]) => v.gy));
      const maxGY = Math.max(...layouts.map(([, v]) => v.gy));
      const cols = (maxGX - minGX + 1) || 1;
      const rows = (maxGY - minGY + 1) || 1;
      // Tile size fit into modal content, reserving space for title and bottom hint,
      // but also small enough to eventually fit 64x64 tiles
      const titleH = Math.ceil(title?.height || 0);
      const hintH = Math.ceil(hint?.height || 0);
      const availW = modal.content.width();
      const availableTop = modal.content.top + titleH + 6;
      const availableBottom = modal.content.bottom - hintH - 6;
      const availH = Math.max(0, availableBottom - availableTop);
      const gap = 1; // tighter gap to allow dense grids
      // Size based on current extents
      const tileW = Math.floor((availW - gap * (cols - 1)) / cols);
      const tileH = Math.floor((availH - gap * (rows - 1)) / rows);
      const layoutTile = Math.floor(Math.min(tileW, tileH));
      // Size required if the map grows to 64x64
      const targetCols = 64;
      const targetRows = 64;
      const tileW64 = Math.floor((availW - gap * (targetCols - 1)) / targetCols);
      const tileH64 = Math.floor((availH - gap * (targetRows - 1)) / targetRows);
      const capTile = Math.floor(Math.min(tileW64, tileH64));
      const tileSize = Math.max(3, Math.min(layoutTile, capTile));
      const gridW = cols * tileSize + (cols - 1) * gap;
      const gridH = rows * tileSize + (rows - 1) * gap;
      const startX = modal.content.left + Math.floor((availW - gridW) / 2);
      const startY = availableTop + Math.floor((availH - gridH) / 2);
      // Draw tiles
      const cont = this.add.container(0, 0).setDepth(622);
      cont.setScrollFactor(0);
      layouts.forEach(([mapId, pos]) => {
        const gx = pos.gx - minGX; const gy = pos.gy - minGY;
        const x = startX + gx * (tileSize + gap) + tileSize / 2;
        const y = startY + gy * (tileSize + gap) + tileSize / 2;
        const visited = this.visitedMaps.has(Number(mapId)) || this.visitedMaps.has(mapId);
        const isCurrent = (mapId == this.currentMap);
  const color = this.maps[mapId]?.color ?? ((this.maps[mapId]?.type === 'shop') ? 0x5a3b2e : 0x228be6);
        const fillAlpha = visited ? 0.95 : 0.08;
        const stroke = visited ? 0xffffff : 0x777777;
        const strokeW = isCurrent ? Math.max(1, Math.floor(tileSize / 8)) : 1;
        const r = this.add.rectangle(x, y, tileSize, tileSize, color, fillAlpha).setStrokeStyle(strokeW, isCurrent ? 0xffff00 : stroke).setDepth(622).setScrollFactor(0);
        cont.add(r);
        if (visited) {
          // Label only when tiles are reasonably large; abbreviate for tiny tiles
          if (tileSize >= 14) {
            const labelText = this.maps[mapId]?.type === 'shop' ? '' : 'Overworld';
            const fs = Math.max(8, Math.floor(tileSize * 0.5));
            const label = this.add.text(x, y, labelText, { fontSize: `${fs}px`, color: '#ffffff' }).setOrigin(0.5).setDepth(623).setScrollFactor(0);
            cont.add(label);
          } else if (tileSize >= 8) {
            const labelText = this.maps[mapId]?.type === 'shop' ? '' : 'O';
            const fs = Math.max(6, Math.floor(tileSize * 0.6));
            const label = this.add.text(x, y, labelText, { fontSize: `${fs}px`, color: '#ffffff' }).setOrigin(0.5).setDepth(623).setScrollFactor(0);
            cont.add(label);
          }
        }
      });
      this.worldMapContainer = this.add.container(0, 0, [modal.backdrop, modal.panel, title, hint, cont]).setDepth(620);
      this.worldMapContainer.setScrollFactor(0);
      // Keep references so close can destroy
      this.worldMapContainer.modal = modal;
    }

    // --- Save / Load ---
    saveGame() {
      try {
        const data = {
          v: 1,
          worldSeed: this.worldSeed >>> 0,
          map: this.currentMap,
          visited: Array.from(this.visitedMaps || []),
          mazeLayouts: (() => {
            const out = {};
            const src = this._mazeLayouts || {};
            for (const k of Object.keys(src)) {
              if (Array.isArray(src[k])) out[k] = src[k];
            }
            return out;
          })(),
          collectedItems: {
            meleeWeapon1: !!(this.collectedItems?.meleeWeapon1),
            meleeWeapon2: !!(this.collectedItems?.meleeWeapon2),
            meleeWeapon3: !!(this.collectedItems?.meleeWeapon3),
            shield1: !!(this.collectedItems?.shield1),
            shield2: !!(this.collectedItems?.shield2),
            shield3: !!(this.collectedItems?.shield3)
          },
          collectedCurrency: Array.from(this.collectedCurrency || []),
          gold: { count: this.goldIngotsCount || 0, goal: this.goldGoal || 11, ids: Array.from(this.collectedGoldIds || []) },
          player: { x: Math.round(this.player.x), y: Math.round(this.player.y), hp: this.health, maxHp: this.maxHealth },
          stamina: { s: Math.round(this.stamina), m: this.maxStamina },
          wallet: this.wallet || { total: 0, counts: { copper: 0, silver: 0 } },
          inventory: (this.inventoryItems || []).map(it => ({ type: it.type, subtype: it.subtype, name: it.name, color: it.color, size: it.size })),
          equipped: {
            weaponIdx: this.equippedWeapon ? this.inventoryItems.indexOf(this.equippedWeapon) : -1,
            shieldIdx: this.equippedShield ? this.inventoryItems.indexOf(this.equippedShield) : -1
          }
        };
        localStorage.setItem('gold.save.v1', JSON.stringify(data));
        console.log('Game saved.');
      } catch (e) {
        console.warn('Save failed', e);
      }
    }

    loadGame() {
      try {
        const raw = localStorage.getItem('gold.save.v1');
        if (!raw) { console.log('No save found'); return; }
        const data = JSON.parse(raw);
        if (!data || data.v !== 1) { console.log('Unknown save version'); return; }
  // World seed (optional in older saves)
  if (Number.isFinite(data.worldSeed)) this.worldSeed = data.worldSeed >>> 0;
        // Map + visited
        this.currentMap = data.map ?? this.currentMap;
        // Restore visited tiles if present
        if (Array.isArray(data.visited)) {
          this.visitedMaps = new Set(data.visited);
        }
        // Restore maze layouts (lock mazes to prior shapes)
        if (data.mazeLayouts && typeof data.mazeLayouts === 'object') {
          this._mazeLayouts = {};
          for (const k of Object.keys(data.mazeLayouts)) {
            const arr = data.mazeLayouts[k];
            if (Array.isArray(arr)) this._mazeLayouts[k] = arr.map(p => Array.isArray(p) ? [p[0]|0, p[1]|0] : p);
          }
        }
        // Restore collected flags BEFORE rebuilding world so spawners respect them
        this.collectedItems = {
          meleeWeapon1: !!(data.collectedItems?.meleeWeapon1),
          meleeWeapon2: !!(data.collectedItems?.meleeWeapon2),
          meleeWeapon3: !!(data.collectedItems?.meleeWeapon3),
          shield1: !!(data.collectedItems?.shield1),
          shield2: !!(data.collectedItems?.shield2),
          shield3: !!(data.collectedItems?.shield3)
        };
        this.collectedCurrency = new Set(Array.isArray(data.collectedCurrency) ? data.collectedCurrency : []);
        // Recreate world objects for the map (now respects collected state)
        this.createMapObjects();
        // Position player
        if (this.player) { this.player.x = data.player?.x ?? this.player.x; this.player.y = data.player?.y ?? this.player.y; }
        // HP/Stamina
        this.health = data.player?.hp ?? this.health; this.maxHealth = data.player?.maxHp ?? this.maxHealth;
        this.stamina = data.stamina?.s ?? this.stamina; this.maxStamina = data.stamina?.m ?? this.maxStamina;
        // Camera bg color based on restored map
        if (this.maps && this.maps[this.currentMap]) {
          this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
        }
        // Wallet
        this.wallet = data.wallet || this.wallet;
        // Inventory reconstruction
        this.inventoryItems = (data.inventory || []).map(it => ({ ...it }));
        // Equip
        if (data.equipped) {
          if (data.equipped.weaponIdx >= 0) this.equippedWeapon = this.inventoryItems[data.equipped.weaponIdx];
          if (data.equipped.shieldIdx >= 0) this.equippedShield = this.inventoryItems[data.equipped.shieldIdx];
          this.hasMeleeWeapon = !!this.equippedWeapon; this.hasShield = !!this.equippedShield;
        }
        // HUD refresh
        const ui = this.scene.get(SCENES.UI);
        if (ui?.scene.isActive()) {
          ui.updateHealthBar(this.health, this.maxHealth);
          const w = this.wallet || { total: 0, counts: { copper: 0, silver: 0 } };
          ui.updateCurrency(w.total || 0, w.counts.copper || 0, w.counts.silver || 0);
          ui.updateStaminaBar?.(this.stamina, this.maxStamina);
          ui.updateGoldIngots?.(this.goldIngotsCount || 0, this.goldGoal || 11);
          try { ui.updateBiome?.(getBiomeForMap(this, this.currentMap)); } catch {}
          this.updateEquipmentHUD();
        }
        console.log('Game loaded.');
      } catch (e) {
        console.warn('Load failed', e);
      }
    }

    // Simple win modal
    showWinModal() {
      if (UIRegistry.anyOpen && UIRegistry.anyOpen()) return; // avoid stacking
      UIRegistry.open?.('win');
      const modal = createModal(this, { coverHUD: true, depthBase: 800, outerMargin: 10, padTop: 20, padBottom: 18 });
      const title = addTitle(this, modal, 'You Win!', { fontSize: '16px', color: '#ffff66' });
      const msg = this.add.text(modal.center.x, modal.center.y, `You collected all ${this.goldGoal} gold ingots!`, { fontSize: '12px', color: '#ffffff', align: 'center', wordWrap: { width: modal.content.width() - 20 } }).setOrigin(0.5).setDepth(802);
      const hint = this.add.text(modal.center.x, modal.content.bottom, 'Press ESC to close', { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 1).setDepth(803);
      this.winModal = { modal, title, msg, hint };
      try { this.physics.world.pause(); } catch {}
      try { this.tweens.pauseAll(); } catch {}
      // Hook ESC to close if not already handled by general ESC handler
      const close = () => {
        UIRegistry.close?.('win');
        [title, msg, hint].forEach(n => { try { n?.destroy(); } catch {} });
        try { modal?.destroy(); } catch {}
        this.winModal = null;
        try { this.physics.world.resume(); } catch {}
        try { this.tweens.resumeAll(); } catch {}
      };
      // If ESC is pressed and no higher-priority UI, let global handler close via stack
      this.closeWinModal = close;
    }

    // --- Mini-map overlay helpers ---
    toggleMiniMap() {
      if (this.miniMapVisible) this.closeMiniMap();
      else this.openMiniMap();
    }

    openMiniMap() {
      if (this.miniMapVisible) return;
      this.miniMapVisible = true;
      this.buildMiniMapContainer();
      this.refreshMiniMap();
    }

    closeMiniMap() {
      this.miniMapVisible = false;
      if (this.miniMapContainer) {
        try { this.miniMapContainer.destroy(); } catch {}
        this.miniMapContainer = null;
      }
    }

    buildMiniMapContainer() {
      if (this.miniMapContainer) { try { this.miniMapContainer.destroy(); } catch {} }
      const maxW = this.miniMapCfg.width;
      const margin = this.miniMapCfg.margin;
      const maxH = Math.max(8, (this.hudHeight - margin * 2));
      const scaleByW = maxW / this.worldPixelWidth;
      const scaleByH = maxH / this.worldPixelHeight;
      const scale = Math.min(scaleByW, scaleByH);
      const width = Math.round(this.worldPixelWidth * scale);
      const height = Math.round(this.worldPixelHeight * scale);
      const x0 = this.worldPixelWidth - margin - width;
      const y0 = 8; // within HUD band
      const cont = this.add.container(0, 0).setDepth(700);
      cont.setScrollFactor(0);
      // Background panel
      const bg = this.add.rectangle(x0 + width / 2, y0 + height / 2, width, height, 0x000000, 0.45)
        .setStrokeStyle(1, 0xffffff)
        .setScrollFactor(0)
        .setDepth(700);
      cont.mmMeta = { x0, y0, width, height, scale };
      cont.add(bg);
      // Player dot
      const pd = this.add.circle(0, 0, 2, 0xffff00).setScrollFactor(0).setDepth(702);
      cont.mmPlayerDot = pd;
      cont.add(pd);
  // Buckets
  cont.mmDoors = this.add.container(0, 0).setDepth(701);
  cont.mmDoors.setScrollFactor?.(0);
  cont.add(cont.mmDoors);
  cont.mmEnemies = this.add.container(0, 0).setDepth(701);
  cont.mmEnemies.setScrollFactor?.(0);
  cont.add(cont.mmEnemies);
  cont.mmNPCs = this.add.container(0, 0).setDepth(701);
  cont.mmNPCs.setScrollFactor?.(0);
  cont.add(cont.mmNPCs);
      this.miniMapContainer = cont;
    }

    refreshMiniMap() {
      if (!this.miniMapContainer) this.buildMiniMapContainer();
      const cont = this.miniMapContainer;
      const { x0, y0, width, height, scale } = cont.mmMeta;
      // Clear door markers
      if (cont.mmDoors) cont.mmDoors.removeAll(true);
      // Add door markers snapped to walls for edge doors
      const doors = this.doorRegistry[this.currentMap] || {};
      Object.keys(doors).forEach((id) => {
        const d = doors[id];
        let wx = d.gridX * this.gridCellSize + this.gridCellSize / 2;
        let wy = d.gridY * this.gridCellSize + this.gridCellSize / 2;
        let mx = x0 + Math.round(wx * scale);
        let my = y0 + Math.round(wy * scale);
        const pad = 2;
        if (d.type === 'edge_west') mx = x0 + pad;
        else if (d.type === 'edge_east') mx = x0 + width - pad;
        if (d.type === 'edge_north') my = y0 + pad;
        else if (d.type === 'edge_south') my = y0 + height - pad;
        const marker = this.add.rectangle(mx, my, 3, 3, 0x00ccff).setScrollFactor(0);
        cont.mmDoors.add(marker);
      });
      this._miniMapLastMap = this.currentMap;
      this.updateMiniMapPlayerDot();
    }

    updateMiniMapPlayerDot() {
      if (!this.miniMapContainer || !this.player) return;
      const cont = this.miniMapContainer;
      const { x0, y0, scale } = cont.mmMeta;
      const mx = x0 + Math.round(this.player.x * scale);
      const my = y0 + Math.round(this.player.y * scale);
      cont.mmPlayerDot.setPosition(mx, my);
    }

    updateMiniMapEntities() {
      if (!this.miniMapContainer) return;
      const cont = this.miniMapContainer;
      const { x0, y0, scale } = cont.mmMeta;
      // Enemies
      const enemies = this.enemiesGroup ? this.enemiesGroup.getChildren() : [];
      cont.mmEnemyDots = cont.mmEnemyDots || [];
      // Ensure enough enemy dots
      for (let i = cont.mmEnemyDots.length; i < enemies.length; i++) {
        const dot = this.add.circle(0, 0, 2, 0xff4444).setScrollFactor(0).setDepth(701);
        cont.mmEnemies.add(dot);
        cont.mmEnemyDots.push(dot);
      }
      // Position and visibility
      for (let i = 0; i < cont.mmEnemyDots.length; i++) {
        const dot = cont.mmEnemyDots[i];
        if (i < enemies.length && enemies[i].active) {
          const e = enemies[i];
          const mx = x0 + Math.round(e.x * scale);
          const my = y0 + Math.round(e.y * scale);
          dot.setPosition(mx, my).setVisible(true);
        } else {
          dot.setVisible(false);
        }
      }
      // NPCs
      const npcs = [];
      if (this.shopkeeper && this.shopkeeper.active) npcs.push(this.shopkeeper);
      cont.mmNPCDots = cont.mmNPCDots || [];
      for (let i = cont.mmNPCDots.length; i < npcs.length; i++) {
        const dot = this.add.rectangle(0, 0, 3, 3, 0x66ccff).setScrollFactor(0).setDepth(701);
        cont.mmNPCs.add(dot);
        cont.mmNPCDots.push(dot);
      }
      for (let i = 0; i < cont.mmNPCDots.length; i++) {
        const dot = cont.mmNPCDots[i];
        if (i < npcs.length) {
          const n = npcs[i];
          const mx = x0 + Math.round(n.x * scale);
          const my = y0 + Math.round(n.y * scale);
          dot.setPosition(mx, my).setVisible(true);
        } else {
          dot.setVisible(false);
        }
      }
    }

    openShopDialog() {
      if (this.dialogOpen) return;
      this.dialogOpen = true;
      UIRegistry.open('shop');
      // Rex UI variant
      if (this.devFlags?.useRexUI && this.rexUI) {
        // Gather available items in the shop
        const items = [];
        const tryPush = (obj) => { if (obj && obj.isShopItem && obj.active) items.push(obj); };
        tryPush(this.meleeWeapon1); tryPush(this.meleeWeapon2); tryPush(this.meleeWeapon3);
        tryPush(this.shield1); tryPush(this.shield2); tryPush(this.shield3);
        tryPush(this.healthPotion1); tryPush(this.healthPotion2); tryPush(this.staminaTonic1);
        const fmtPrice = (p) => { const s = Math.floor(p / 5), c = p % 5; if (s > 0 && c > 0) return `${s}s ${c}c`; if (s > 0) return `${s}s`; return `${c}c`; };
        const totalP = (this.getWalletTotal || getWalletTotal)?.call(this, this) ?? getWalletTotal(this);
        const enriched = items.map(it => {
          const price = getItemPrice(it.itemType, it.itemSubtype);
          return { ...it, price, priceStr: `${fmtPrice(price)} (${price}p)`, affordable: totalP >= price };
        });
        const silver = (this.wallet?.counts?.silver || 0);
        const copper = (this.wallet?.counts?.copper || 0);
        const walletText = `Wallet: ${silver}s ${copper}c (${fmtPrice(totalP)} / ${totalP}p)`;
        const onBuy = (choice) => {
          const price = choice.price;
          const ok = (this.spendFromWallet || this._spendFromWalletShim)?.call(this, price);
          if (!ok) { this.showToast('Not enough coins!'); return false; }
          if (choice.itemType === 'weapon') {
            const weaponItem = { type: 'weapon', subtype: choice.itemSubtype, name: choice.itemName, color: this.getWeaponColor(choice.itemSubtype), size: this.getWeaponSize(choice.itemSubtype), swingDuration: this.getWeaponSwingDuration(choice.itemSubtype) };
            const added = this.addToInventory(weaponItem);
            if (added) {
              try { choice.destroy(); } catch {}
              if (!this.equippedWeapon) { this.equipWeapon(weaponItem); this.updateEquipmentHUD(); }
              if (choice === this.meleeWeapon1) this.collectedItems.meleeWeapon1 = true;
              else if (choice === this.meleeWeapon2) this.collectedItems.meleeWeapon2 = true;
              else if (choice === this.meleeWeapon3) this.collectedItems.meleeWeapon3 = true;
              this.showToast(`Purchased ${weaponItem.name}!`);
            } else { this._spendFromWalletShim(-price); this.showToast('Inventory full!'); return false; }
          } else if (choice.itemType === 'shield') {
            const shieldItem = { type: 'shield', subtype: choice.itemSubtype, name: choice.itemName, color: this.getShieldColor(choice.itemSubtype), size: this.getShieldSize(choice.itemSubtype) };
            const added = this.addToInventory(shieldItem);
            if (added) {
              try { choice.destroy(); } catch {}
              if (!this.equippedShield) { this.equipShield(shieldItem); this.updateEquipmentHUD(); }
              if (choice === this.shield1) this.collectedItems.shield1 = true;
              else if (choice === this.shield2) this.collectedItems.shield2 = true;
              else if (choice === this.shield3) this.collectedItems.shield3 = true;
              this.showToast(`Purchased ${shieldItem.name}!`);
            } else { this._spendFromWalletShim(-price); this.showToast('Inventory full!'); return false; }
          } else if (choice.itemType === 'consumable' || choice.itemType === 'potion' || choice.itemType === 'consumable') {
            try { choice.destroy(); } catch {}
            if (choice === this.healthPotion1) this.collectedItems.healthPotion1 = true;
            else if (choice === this.healthPotion2) this.collectedItems.healthPotion2 = true;
            else if (choice === this.staminaTonic1) this.collectedItems.staminaTonic1 = true;
            if (choice.healAmount && choice.healAmount > 0) { this.heal(choice.healAmount); this.showToast(`Used ${choice.itemName}! +${choice.healAmount} HP`); }
            if (choice.staminaAmount && choice.staminaAmount > 0) { this.stamina = Math.min(this.maxStamina, this.stamina + choice.staminaAmount); this.updateStaminaBar(); this.showToast(`Used ${choice.itemName}! +${choice.staminaAmount} Stamina`); }
          }
          return true;
        };
        const onClose = () => { this.closeShopDialog(); };
        this.shopDialog = RexUI.showShopDialogRex(this, enriched, { onClose, onBuy, walletText, pageSize: 6 });
        return;
      }
      // Gather available items in the shop
      const items = [];
      const tryPush = (obj) => { if (obj && obj.isShopItem && obj.active) items.push(obj); };
      tryPush(this.meleeWeapon1); tryPush(this.meleeWeapon2); tryPush(this.meleeWeapon3);
      tryPush(this.shield1); tryPush(this.shield2); tryPush(this.shield3);
      tryPush(this.healthPotion1); tryPush(this.healthPotion2); tryPush(this.staminaTonic1);
      // Price formatting helper (silver/copper denominations)
      const fmtPrice = (p) => {
        const s = Math.floor(p / 5), c = p % 5;
        if (s > 0 && c > 0) return `${s}s ${c}c`;
        if (s > 0) return `${s}s`;
        return `${c}c`;
      };
  // Use unified UI modal
  const modal = createModal(this, { coverHUD: false, depthBase: 500 });
    const leftX = modal.content.left;
    const rightX = modal.content.right;
    const topY = modal.content.top;
    const bottomY = modal.content.bottom;
    this.dialogBackdrop = modal.backdrop;
    this.dialogPanel = modal.panel;
    this.dialogText = addTitle(this, modal, 'Welcome! What would you like to buy?');
      // Show current wallet in both denominations and total pence
      const silver = (this.wallet?.counts?.silver || 0);
      const copper = (this.wallet?.counts?.copper || 0);
      const totalP = getWalletTotal(this);
      const walletY = topY + 18;
      this.dialogWalletText = this.add.text(
        modal.center.x,
        walletY,
        `Wallet: ${silver}s ${copper}c (${fmtPrice(totalP)} / ${totalP}p)`,
        { fontSize: '10px', color: '#aaddff' }
      ).setOrigin(0.5, 0).setDepth(502);
      // Compute list layout respecting padding with pagination
      const listStartY = walletY + 20;
      const lineHeight = 18;
      const maxListHeight = (bottomY - 18) - listStartY; // 18 reserved for hint
      const maxLines = Math.max(1, Math.floor(maxListHeight / lineHeight));
      this.dialogItemsPerPage = Math.min(6, maxLines); // keep 1-6 keys mapping
      this.dialogPageIndex = 0;
      const pageCount = Math.max(1, Math.ceil(items.length / this.dialogItemsPerPage));
      const walletTotalNow = totalP;

      // Page indicator
  const pageY = bottomY - 2;
  this.dialogPageText = this.add.text(rightX, pageY, '', { fontSize: '9px', color: '#dddddd' }).setOrigin(1, 1).setDepth(502);

      // Render function
      const renderList = () => {
        // Clear previous
        if (this.dialogListTexts) this.dialogListTexts.forEach(t => { try { t.destroy(); } catch {} });
        this.dialogListTexts = [];
        // Page bounds
        const start = this.dialogPageIndex * this.dialogItemsPerPage;
        const end = Math.min(start + this.dialogItemsPerPage, items.length);
        for (let i = start, row = 0; i < end; i++, row++) {
          const it = items[i];
          const price = getItemPrice(it.itemType, it.itemSubtype);
          const affordable = walletTotalNow >= price;
          const priceStr = `${fmtPrice(price)} (${price}p)`;
          const line = `${row+1}. ${it.itemName} - ${priceStr}`;
          const color = affordable ? '#ffffaa' : '#888888';
          const t = this.add.text(leftX, listStartY + row * lineHeight, line, { fontSize: '11px', color })
            .setDepth(502);
          t.setWordWrapWidth(Math.max(0, rightX - leftX));
          this.dialogListTexts.push(t);
        }
        // Hint updates
        const hasPages = pageCount > 1;
        const hintText = hasPages ? '1-6 to buy, ESC to cancel, A/D or ◀/▶ to change page' : 'Press 1-6 to buy, or ESC to cancel';
  if (this.dialogHint) { try { this.dialogHint.destroy(); } catch {} }
  this.dialogHint = this.add.text(modal.center.x, bottomY, hintText, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5, 1).setDepth(502);
        // Page indicator text
        this.dialogPageText.setText(hasPages ? `Page ${this.dialogPageIndex+1}/${pageCount}` : '');
      };

  renderList();
  // If inventory is open, hide it while shop dialog is active
  if (this.inventoryOpen) { this.hideInventory(); this.inventoryOpen = false; }

      // Temporarily block movement inputs while dialog is open
      this.input.keyboard.enabled = true;
      // Ensure only one active handler
      if (this._shopKeyHandler) { try { this.input.keyboard.off('keydown', this._shopKeyHandler); } catch {} }
      const onKey = (e) => {
        const code = e.code;
        if (code === 'Escape' || code === 'KeyC') { this.input.keyboard.off('keydown', onKey); this.closeShopDialog(); return; }
        // Page navigation: A/D or ArrowLeft/ArrowRight
        if (code === 'KeyA' || code === 'ArrowLeft') {
          if (this.dialogPageIndex > 0) { this.dialogPageIndex--; renderList(); }
          return;
        }
        if (code === 'KeyD' || code === 'ArrowRight') {
          if ((this.dialogPageIndex + 1) * this.dialogItemsPerPage < items.length) { this.dialogPageIndex++; renderList(); }
          return;
        }
        // Number selection mapped to current page
        const localIdx = ({Digit1:0, Digit2:1, Digit3:2, Digit4:3, Digit5:4, Digit6:5})[code];
        if (localIdx === undefined) return;
        const globalIdx = this.dialogPageIndex * this.dialogItemsPerPage + localIdx;
        const choice = items[globalIdx];
        if (!choice) return;
        const price = getItemPrice(choice.itemType, choice.itemSubtype);
        const ok = this._spendFromWalletShim(price);
        if (!ok) { this.showToast('Not enough coins!'); return; }
        // Convert choice to an inventory item and add
        if (choice.itemType === 'weapon') {
          const weaponItem = {
            type: 'weapon',
            subtype: choice.itemSubtype,
            name: choice.itemName,
            color: this.getWeaponColor(choice.itemSubtype),
            size: this.getWeaponSize(choice.itemSubtype),
            swingDuration: this.getWeaponSwingDuration(choice.itemSubtype)
          };
          const added = this.addToInventory(weaponItem);
          if (added) {
            choice.destroy();
            // If none equipped, auto-equip
            if (!this.equippedWeapon) { this.equipWeapon(weaponItem); this.updateEquipmentHUD(); }
            // Mark collected to avoid respawn
            if (choice === this.meleeWeapon1) this.collectedItems.meleeWeapon1 = true;
            else if (choice === this.meleeWeapon2) this.collectedItems.meleeWeapon2 = true;
            else if (choice === this.meleeWeapon3) this.collectedItems.meleeWeapon3 = true;
            this.showToast(`Purchased ${weaponItem.name}!`);
          } else {
            // Refund if inventory full
            this._spendFromWalletShim(-price);
            this.showToast('Inventory full!');
          }
        } else if (choice.itemType === 'shield') {
          const shieldItem = {
            type: 'shield',
            subtype: choice.itemSubtype,
            name: choice.itemName,
            color: this.getShieldColor(choice.itemSubtype),
            size: this.getShieldSize(choice.itemSubtype)
          };
          const added = this.addToInventory(shieldItem);
          if (added) {
            choice.destroy();
            if (!this.equippedShield) { this.equipShield(shieldItem); this.updateEquipmentHUD(); }
            if (choice === this.shield1) this.collectedItems.shield1 = true;
            else if (choice === this.shield2) this.collectedItems.shield2 = true;
            else if (choice === this.shield3) this.collectedItems.shield3 = true;
            this.showToast(`Purchased ${shieldItem.name}!`);
          } else {
            this._spendFromWalletShim(-price);
            this.showToast('Inventory full!');
          }
        } else if (choice.itemType === 'consumable') {
          // Consumables are used immediately, not added to inventory
          choice.destroy();
          // Mark collected to avoid respawn
          if (choice === this.healthPotion1) this.collectedItems.healthPotion1 = true;
          else if (choice === this.healthPotion2) this.collectedItems.healthPotion2 = true;
          else if (choice === this.staminaTonic1) this.collectedItems.staminaTonic1 = true;
          
          // Apply consumable effects
          if (choice.healAmount && choice.healAmount > 0) {
            this.heal(choice.healAmount);
            this.showToast(`Used ${choice.itemName}! +${choice.healAmount} HP`);
          }
          if (choice.staminaAmount && choice.staminaAmount > 0) {
            this.stamina = Math.min(this.maxStamina, this.stamina + choice.staminaAmount);
            this.updateStaminaBar();
            this.showToast(`Used ${choice.itemName}! +${choice.staminaAmount} Stamina`);
          }
        }
        this.input.keyboard.off('keydown', onKey);
        this.closeShopDialog();
      };
      this._shopKeyHandler = onKey;
      this.input.keyboard.on('keydown', onKey);
    }

    closeShopDialog() {
      this.dialogOpen = false;
      if (this.shopDialog) { try { this.shopDialog.destroy(); } catch {} this.shopDialog = null; }
  [this.dialogBackdrop, this.dialogPanel, this.dialogText, this.dialogHint, this.dialogWalletText, this.dialogPageText].forEach(el => { try { el?.destroy(); } catch {} });
      if (this.dialogListTexts) { this.dialogListTexts.forEach(t => { try { t.destroy(); } catch {} }); }
      this.dialogBackdrop = this.dialogPanel = this.dialogText = this.dialogHint = this.dialogWalletText = this.dialogPageText = null;
      this.dialogListTexts = null;
      this.dialogItemsPerPage = 0;
      this.dialogPageIndex = 0;
      // Remove lingering key listener if any
      if (this._shopKeyHandler) { try { this.input.keyboard.off('keydown', this._shopKeyHandler); } catch {} }
      this._shopKeyHandler = null;
      try { UIRegistry.close('shop'); } catch {}
    }

    purchaseHealthTonic() {
      // Cost 5p, heal 25
      const ok = (this.spendFromWallet || this._spendFromWalletShim)?.call(this, 5);
      if (!ok) {
        this.showToast('Not enough coins!');
        return;
      }
      this.heal(25);
      this.showToast('Glug glug! +25 HP');
    }

    showToast(msg) {
      const t = this.add.text(this.player.x, this.player.y - 20, msg, { fontSize: '9px', color: '#ffffff', backgroundColor: '#00000080' }).setOrigin(0.5).setDepth(600);
      if (this.worldLayer) this.worldLayer.add(t);
      this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }
}