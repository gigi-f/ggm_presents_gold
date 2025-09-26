import Phaser from 'phaser';
import { MAP_IDS, DOOR_IDS, SCENES } from './lib/constants';
import * as World from './lib/world.js';
import { beginTransition, endTransition, scrollTransitionToMap as scrollXfer } from './lib/transitions.js';
import * as Inventory from './lib/inventory.js';
import * as Combat from './lib/combat.js';

export class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    // World sizing
    this.gridCellSize = 16;
    this.worldPixelWidth = 384;   // 24 cells
    this.worldPixelHeight = 288;  // 18 cells
    this.hudHeight = 64;          // HUD band height
    this.edgeGapRadius = 1;       // entrance half-width in tiles

    // State flags
    this.currentMap = MAP_IDS.OVERWORLD_01;
    this.transitionLock = false;
    this.isScrolling = false;
    this.worldLayer = null;

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
    this.bush = null;
    this.stump = null;
    this.health = 100;
    this.maxHealth = 100;

    // Map graph
    this.maps = {
      [MAP_IDS.OVERWORLD_01]: {
        type: 'overworld',
        color: 0x228be6,
        exits: { right: MAP_IDS.OVERWORLD_02 },
        doors: {
          [DOOR_IDS.SHOP_DOOR_01]: { targetMap: MAP_IDS.SHOP_01, targetDoor: DOOR_IDS.SHOP_EXIT_01 },
          [DOOR_IDS.EAST_EXIT_A]: { targetMap: MAP_IDS.OVERWORLD_02, targetDoor: DOOR_IDS.WEST_ENTRY_A },
          [DOOR_IDS.EAST_EXIT_B]: { targetMap: MAP_IDS.OVERWORLD_02, targetDoor: DOOR_IDS.WEST_ENTRY_B }
        }
      },
      [MAP_IDS.OVERWORLD_02]: {
        type: 'overworld',
        color: 0x51cf66,
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
      [MAP_IDS.OVERWORLD_01]: {
        [DOOR_IDS.SHOP_DOOR_01]: { gridX: 4, gridY: 8, type: 'building_entrance' },
        [DOOR_IDS.EAST_EXIT_A]: { gridX: 19, gridY: 5, type: 'edge_east' },
        [DOOR_IDS.EAST_EXIT_B]: { gridX: 19, gridY: 10, type: 'edge_east' }
      },
      [MAP_IDS.SHOP_01]: {
        [DOOR_IDS.SHOP_EXIT_01]: { gridX: 10, gridY: 13, type: 'building_exit' }
      },
      [MAP_IDS.OVERWORLD_02]: {
        [DOOR_IDS.WEST_ENTRY_A]: { gridX: 0, gridY: 5, type: 'edge_west' },
        [DOOR_IDS.WEST_ENTRY_B]: { gridX: 0, gridY: 10, type: 'edge_west' }
      }
    };

    this.activeDoors = {};
    this.collectedItems = {
      meleeWeapon1: false,
      meleeWeapon2: false,
      meleeWeapon3: false,
      shield1: false,
      shield2: false,
      shield3: false
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
          (targetDoorData.gridY + 4) * 16 + 8); // Position player south of entrance door (outside building)
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

        // Compute landing position: keep axis aligned with travel
        // Horizontal travel (left/right): preserve player's Y, adjust X just inside target edge
        // Vertical travel (up/down): preserve player's X, adjust Y just inside target edge
        let x = this.player.x;
        let y = this.player.y;
        if (direction === 'right' || targetDoorData.type === 'edge_west') {
          // Entering from the left into the target map's west edge
          x = cs * 2; // just inside beyond the west sensor
          y = this.player.y; // preserve vertical position
        } else if (direction === 'left' || targetDoorData.type === 'edge_east') {
          // Entering from the right into the target map's east edge
          x = W - cs * 2; // just inside beyond the east sensor
          y = this.player.y; // preserve vertical position
        } else if (direction === 'up' || targetDoorData.type === 'edge_south') {
          // Entering from the bottom into the target map's south edge
          y = H - cs * 2; // just inside beyond the south sensor
          x = this.player.x; // preserve horizontal position
        } else if (direction === 'down' || targetDoorData.type === 'edge_north') {
          // Entering from the top into the target map's north edge
          y = cs * 2; // just inside beyond the north sensor
          x = this.player.x; // preserve horizontal position
        }

        // If we're in an overworld map, use smooth scrolling based on the source edge

        if (this.maps[this.currentMap]?.type === 'overworld' && direction) {
          this.scrollTransitionToMap(direction, targetInfo.targetMap, x, y);
        } else {
          // Fallback to instant transition (e.g., for non-overworld maps)
          this.transitionToMapWithLock(targetInfo.targetMap, x, y);
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
      
      // Flash the player red when taking damage by changing fill color
      const originalColor = this.player.fillColor;
      this.player.setFillStyle(0xff0000);
      this.time.delayedCall(200, () => {
        this.player.setFillStyle(originalColor);
      });
      
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
  
    preload() {}
  
  create() {
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

      // Pre-warm the physics system
      this.physics.world.fixedStep = true;
      this.physics.world.fps = 60;

      // Initialize all keyboard inputs
      this.keys = {
        inventory: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
        meleeWeapon: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
        shield: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
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
        console.log('I key pressed - toggling inventory');
        this.toggleInventory();
      });

      this.input.keyboard.on('keydown-P', (event) => {
        if (event?.preventDefault) event.preventDefault();
        if (event?.stopPropagation) event.stopPropagation();
        console.log('P key pressed - toggling grid visibility');
        this.toggleGridVisibility();
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
  this.player = this.add.circle(this.worldPixelWidth/2, this.worldPixelHeight/2, 8, 0xffff00);
      this.player.setDepth(1); // Put player above ground objects
      this.physics.add.existing(this.player);

      // Initialize grid system for object placement
      this.initializeGrid();

      // Create boundary rocks and map-specific objects
      this.createMapObjects();

      // Set up collisions with main bush (will be handled in createMapObjects)
      // this.physics.add.collider(this.player, this.bush);

      // Pre-warm the renderer by doing a quick update
      this.time.delayedCall(16, () => {
        this.physics.world.step(16);
      });
    }

    equipDefaultWeapon() { return Inventory.equipDefaultWeapon(this); }

    updateEquipmentHUD() { return Inventory.updateEquipmentHUD(this); }

    transitionToMap(newMapIndex, playerX, playerY) {
      this.currentMap = newMapIndex;
      this.player.x = playerX;
      this.player.y = playerY;
      this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
      this.createMapObjects(); // Recreate boundary rocks and map objects
    }

    update(time, delta) {
      if (!this.player) return;
      // Block movement and map checks while the scroll transition runs
      if (this.isScrolling) {
        if (this.player.body) {
          this.player.body.setVelocity(0, 0);
        }
        return;
      }

        // Input is handled via event listeners; avoid duplicating with JustDown/JustUp here to prevent double triggers.
  
      const body = this.player.body;
      body.setVelocity(0);

      // Handle movement with diagonal normalization
      let velocityX = 0;
      let velocityY = 0;
      const speed = 100;

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

      // Update shield position if shield is raised and player is moving
      if (this.shieldRaised && (velocityX !== 0 || velocityY !== 0)) {
        this.updateShieldPosition();
      }
  
      // Overworld transitions are handled solely by edge sensors; no boundary-based triggers.
    }
}