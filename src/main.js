class MainScene extends Phaser.Scene {
    shieldRaised = false;
    shieldKey = null;
    shieldSprite = null;
    hasShield = false;
    shield = null;
    shieldType = 'basic';
    shieldName = 'None';
    inventoryItems = [];
    inventorySelected = 0;
    inventoryOpen = false;
    inventoryPanel = null;
    inventoryKey = null;
    maxInventorySize = 8;
    equippedWeapon = null;
    equippedShield = null;
    hudWeaponIcon = null;
    hudEmptyIcon = null;
    lastHudState = null;
    lastDirection = 'right'; // right, left, up, down
    hasMeleeWeapon = false;
    meleeWeapon = null;
    meleeWeaponType = 'basic';
    meleeWeaponName = 'None';
    meleeWeaponAttack = null;
    meleeWeaponKey = null;
    debugText = null;
    meleeWeaponSwingAngle = 0;
    meleeWeaponSwinging = false;
  meleeWeaponSprite = null;
  bush = null;
  stump = null;
  health = 100;
  maxHealth = 100;    constructor() {
      super('MainScene');
  // World sizing (~20% smaller than previous 480x352): now 384x288, HUD band is twice as tall (64px)
  this.gridCellSize = 16;
  this.worldPixelWidth = 384;   // 24 cells
  this.worldPixelHeight = 288;  // 18 cells
  this.hudHeight = 64;          // reserved HUD band height
    // Shared radius for edge gaps (1 => 3 tiles wide/high)
    this.edgeGapRadius = 1;
      this.currentMap = 'overworld_01'; // Use string IDs instead of indices
      // Transition lock to avoid instant re-trigger on doors
      this.transitionLock = false;
    // Prevent movement during scrolling transition between overworld tiles
    this.isScrolling = false;
      // Parent container for all map-created objects for easy cleanup
      this.worldLayer = null;
      
      // Extensible map system with different types
      this.maps = {
        // Overworld maps
        'overworld_01': {
          type: 'overworld',
          color: 0x228be6,
          exits: { right: 'overworld_02' },
          doors: {
            'shop_door_01': { targetMap: 'shop_01', targetDoor: 'shop_exit_01' },
            // Sample multi-exit on east wall leading to overworld_02
            'east_exit_A': { targetMap: 'overworld_02', targetDoor: 'west_entry_A' },
            'east_exit_B': { targetMap: 'overworld_02', targetDoor: 'west_entry_B' }
          }
        },
        'overworld_02': {
          type: 'overworld', 
          color: 0x51cf66,
          exits: { left: 'overworld_01' },
          doors: {
            // Return paths from sample multi-exit
            'west_entry_A': { targetMap: 'overworld_01', targetDoor: 'east_exit_A' },
            'west_entry_B': { targetMap: 'overworld_01', targetDoor: 'east_exit_B' }
          }
        },
        
        // Shop interiors
        'shop_01': {
          type: 'shop',
          color: 0x8B4513,
          exits: {},
          doors: {
            'shop_exit_01': { targetMap: 'overworld_01', targetDoor: 'shop_door_01' }
          }
        }
        
        // Future extensibility:
        // 'dungeon_01': { type: 'dungeon', color: 0x444444, exits: {}, doors: {...} },
        // 'overworld_03': { type: 'overworld', color: 0x32CD32, exits: {}, doors: {...} },
        // etc.
      };
      
      this.player = null;
      
      // Door registry - defines door positions and connections for each map
      this.doorRegistry = {
        'overworld_01': {
          'shop_door_01': { gridX: 4, gridY: 8, type: 'building_entrance' },
          // Two separate east-edge exits to demonstrate multi-exit per wall
          'east_exit_A': { gridX: 19, gridY: 5, type: 'edge_east' },
          'east_exit_B': { gridX: 19, gridY: 10, type: 'edge_east' }
        },
        'shop_01': {
          'shop_exit_01': { gridX: 10, gridY: 13, type: 'building_exit' }
        },
        'overworld_02': {
          // Matching west-edge entries for the two east exits
          'west_entry_A': { gridX: 0, gridY: 5, type: 'edge_west' },
          'west_entry_B': { gridX: 0, gridY: 10, type: 'edge_west' }
        }
        
        // Future doors can be added like:
        // 'overworld_02': {
        //   'dungeon_door_01': { gridX: 8, gridY: 12, type: 'dungeon_entrance' }
        // },
        // 'dungeon_01': {
        //   'dungeon_exit_01': { gridX: 5, gridY: 14, type: 'dungeon_exit' }
        // }
      };
      
      // Track active doors on current map
      this.activeDoors = {};
      
      // Track which items have been collected to prevent regeneration
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
    initializeGrid() {
      // Create a grid system - 20x15 grid for 320x240 world (16px per cell)
      this.gridWidth = Math.floor(this.worldPixelWidth / this.gridCellSize);
      this.gridHeight = Math.floor(this.worldPixelHeight / this.gridCellSize);
      // this.gridCellSize already set in constructor
      this.occupiedCells = new Set();
      
      // Debug grid visualization
      this.gridVisible = false;
      this.gridLines = null;
    }

    // Returns true if the index lies within any gap defined by skipSet with the configured radius
    isInEdgeGap(index, skipSet) {
      const r = this.edgeGapRadius ?? 1;
      for (let i = -r; i <= r; i++) {
        if (skipSet.has(index + i)) return true;
      }
      return false;
    }

    isGridCellAvailable(gridX, gridY) {
      // Check bounds
      if (gridX < 1 || gridX >= this.gridWidth - 1 || gridY < 1 || gridY >= this.gridHeight - 1) {
        return false;
      }
      
      // Check if cell is occupied
      const cellKey = `${gridX},${gridY}`;
      return !this.occupiedCells.has(cellKey);
    }

    occupyGridCell(gridX, gridY) {
      const cellKey = `${gridX},${gridY}`;
      this.occupiedCells.add(cellKey);
    }

    gridToWorld(gridX, gridY) {
      return {
        x: gridX * this.gridCellSize + this.gridCellSize / 2,
        y: gridY * this.gridCellSize + this.gridCellSize / 2
      };
    }

    worldToGrid(worldX, worldY) {
      return {
        gridX: Math.floor(worldX / this.gridCellSize),
        gridY: Math.floor(worldY / this.gridCellSize)
      };
    }

    placeObjectOnGrid(gridX, gridY, objectType, addToGroup = null, extraData = {}) {
      if (!this.isGridCellAvailable(gridX, gridY)) {
        return null;
      }

      const worldPos = this.gridToWorld(gridX, gridY);
      let obj = null;

      switch (objectType) {
        case 'bush':
          obj = this.add.circle(worldPos.x, worldPos.y, 12, 0x228b22);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'weapon':
          obj = this.add.rectangle(worldPos.x, worldPos.y, extraData.width, extraData.height, extraData.color);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.weaponType = extraData.weaponType;
          obj.weaponName = extraData.weaponName;
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'shield':
          obj = this.add.rectangle(worldPos.x, worldPos.y, extraData.width, extraData.height, extraData.color);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.shieldType = extraData.shieldType;
          obj.shieldName = extraData.shieldName;
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'treeTrunkSmall':
          obj = this.add.rectangle(worldPos.x, worldPos.y, 12, 32, 0x654321);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.setDepth(0);
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'treeTrunkMedium':
          obj = this.add.rectangle(worldPos.x, worldPos.y, 14, 32, 0x8B4513);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.setDepth(0);
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'treeTrunkLarge':
          obj = this.add.rectangle(worldPos.x, worldPos.y, 16, 32, 0x8B4513);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.setDepth(0);
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'shopDoor':
          // Use Door Container prefab for composite door
          obj = this.createDoorContainer(worldPos.x, worldPos.y, extraData.kind || 'entrance', extraData);
          if (addToGroup && obj && obj.doorRect) addToGroup.add(obj.doorRect);
          if (this.worldLayer && obj) this.worldLayer.add(obj);
          break;
        
        case 'buildingWall':
          obj = this.add.rectangle(worldPos.x, worldPos.y, 16, 16, 0x8B4513);
          this.physics.add.existing(obj);
          obj.body.setImmovable(true);
          obj.setDepth(0);
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
        
        case 'shopSign':
          obj = this.add.rectangle(worldPos.x, worldPos.y, 32, 16, 0x654321);
          obj.setDepth(1);
          
          // Add "SHOP" text on the sign
          const signText = this.add.text(worldPos.x, worldPos.y, 'SHOP', {
            fontSize: '8px',
            fill: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold'
          });
          signText.setOrigin(0.5, 0.5);
          signText.setDepth(2);
          if (this.worldLayer) this.worldLayer.add(signText);
          
          if (addToGroup) addToGroup.add(obj);
          if (this.worldLayer) this.worldLayer.add(obj);
          break;
      }

      if (obj) {
        this.occupyGridCell(gridX, gridY);
      }
      
      return obj;
    }

    // Create a composite Door as a Container that owns its parts
    createDoorContainer(worldX, worldY, kind = 'entrance', meta = {}) {
      const container = this.add.container(worldX, worldY);
      container.setDepth(1);
      container.isDoorContainer = true;
      container.kind = kind;

      // Door rectangle used for physics overlap (centered in container space)
      const doorRect = this.add.rectangle(0, 0, 16, 32, 0x654321);
      this.physics.add.existing(doorRect);
      doorRect.body.setImmovable(false);
      doorRect.setDepth(1);
      doorRect.isShopDoor = true;
  doorRect.ownerContainer = container;

      // Handle
      const handle = this.add.circle(4, 0, 2, 0xFFD700);
      handle.setDepth(2);
      handle.isDoorHandle = true;

      container.add([doorRect, handle]);
      container.doorRect = doorRect;
      container.doorHandle = handle;

      return container;
    }

    createGridVisualization() {
      if (this.gridLines) {
        this.gridLines.destroy();
      }
      
      this.gridLines = this.add.graphics();
      this.gridLines.setDepth(10); // Above most objects but below UI
      this.gridLines.setScrollFactor(0);
      this.gridLines.setAlpha(0.3); // Semi-transparent
      
      // Draw vertical lines
      for (let x = 0; x <= this.gridWidth; x++) {
        const worldX = x * this.gridCellSize;
        this.gridLines.lineStyle(1, 0x00FF00); // Green lines
        this.gridLines.beginPath();
        this.gridLines.moveTo(worldX, 0);
        this.gridLines.lineTo(worldX, this.gridHeight * this.gridCellSize);
        this.gridLines.strokePath();
      }
      
      // Draw horizontal lines
      for (let y = 0; y <= this.gridHeight; y++) {
        const worldY = y * this.gridCellSize;
        this.gridLines.lineStyle(1, 0x00FF00); // Green lines
        this.gridLines.beginPath();
        this.gridLines.moveTo(0, worldY);
        this.gridLines.lineTo(this.gridWidth * this.gridCellSize, worldY);
        this.gridLines.strokePath();
      }
      
      // Highlight occupied cells
      this.occupiedCells.forEach(cellKey => {
        const [gridX, gridY] = cellKey.split(',').map(Number);
        const worldPos = this.gridToWorld(gridX, gridY);
        
        this.gridLines.fillStyle(0xFF0000, 0.2); // Red semi-transparent
        this.gridLines.fillRect(
          worldPos.x - this.gridCellSize / 2,
          worldPos.y - this.gridCellSize / 2,
          this.gridCellSize,
          this.gridCellSize
        );
      });
      
      this.gridLines.setVisible(this.gridVisible);
    }

    toggleGridVisibility() {
      this.gridVisible = !this.gridVisible;
      
      if (this.gridVisible) {
        this.createGridVisualization();
        console.log('Grid visualization ON - Green lines show grid, red squares show occupied cells');
      } else {
        if (this.gridLines) {
          this.gridLines.setVisible(false);
        }
        console.log('Grid visualization OFF');
      }
    }

    createMapObjects(options = {}) {
      // Clear occupied cells for new map
      this.occupiedCells.clear();

      // Destroy prior world layer (and everything parented under it)
      if (!options.preserveExistingWorld && this.worldLayer) {
        this.worldLayer.destroy(true);
      }
      // Create a fresh world layer container unless the caller wants to build into an existing one
      if (!options.buildIntoExistingWorldLayer || !this.worldLayer) {
        this.worldLayer = this.add.container(0, 0);
      }

      // Reset active doors
      this.activeDoors = {};

      // Ensure groups exist (and will be re-populated)
      if (!this.boundaryRocks) this.boundaryRocks = this.add.group();
      if (!this.mapBushes) this.mapBushes = this.add.group();
      if (!this.treeTrunks) this.treeTrunks = this.add.group();
      if (!this.stumps) this.stumps = this.add.group();
      if (!this.buildingWalls) this.buildingWalls = this.add.group();

  // Create boundary rocks based on current map exits/doors
      const currentMapData = this.maps[this.currentMap];
      const isShop = currentMapData.type === 'shop';
      const isDungeon = currentMapData.type === 'dungeon';
  const cs = this.gridCellSize;
  const W = this.worldPixelWidth;
  const H = this.worldPixelHeight;

      // Compute wall gaps for edge exits (allow multiple per side)
      const mapDoors = this.doorRegistry[this.currentMap] || {};
      const skipTopXs = new Set();
      const skipBottomXs = new Set();
      const skipLeftYs = new Set();
      const skipRightYs = new Set();
      for (const [, d] of Object.entries(mapDoors)) {
        // Edge doors explicitly placed on borders
        if (d.type === 'edge_north') {
          skipTopXs.add(d.gridX);
        } else if (d.type === 'edge_south') {
          skipBottomXs.add(d.gridX);
        } else if (d.type === 'edge_west') {
          skipLeftYs.add(d.gridY);
        } else if (d.type === 'edge_east') {
          skipRightYs.add(d.gridY);
        }
        // Building exits very near bottom edge (e.g., shop interior) — free the wall below the door
        if (d.type === 'building_exit' && d.gridY >= 13) {
          skipBottomXs.add(d.gridX);
        }
      }

      // Top boundary rocks
      for (let x = 0; x < W; x += cs) {
        const gx = Math.floor(x / cs);
        if (this.isInEdgeGap(gx, skipTopXs)) {
          continue; // leave a gap for top edge door(s)
        }
        if (isShop) {
          const rock1 = this.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock1);
          rock1.body.setImmovable(true);
          this.boundaryRocks.add(rock1);
          if (this.worldLayer) this.worldLayer.add(rock1);
          const rock2 = this.add.rectangle(x + cs/2, cs + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock2);
          rock2.body.setImmovable(true);
          this.boundaryRocks.add(rock2);
          if (this.worldLayer) this.worldLayer.add(rock2);
        } else {
          const rock = this.add.rectangle(x + cs/2, cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock);
          rock.body.setImmovable(true);
          this.boundaryRocks.add(rock);
          if (this.worldLayer) this.worldLayer.add(rock);
        }
      }
      
      // Bottom boundary rocks
      for (let x = 0; x < W; x += cs) {
        const gx = Math.floor(x / cs);
        if (this.isInEdgeGap(gx, skipBottomXs)) {
          continue; // leave a gap for bottom edge door(s)
        }
        if (isShop) {
          // Double thickness for shop
          const rock1 = this.add.rectangle(x + cs/2, H - (cs + cs/2), cs, cs, 0x666666);
          this.physics.add.existing(rock1);
          rock1.body.setImmovable(true);
          this.boundaryRocks.add(rock1);
          if (this.worldLayer) this.worldLayer.add(rock1);

          const rock2 = this.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock2);
          rock2.body.setImmovable(true);
          this.boundaryRocks.add(rock2);
          if (this.worldLayer) this.worldLayer.add(rock2);
        } else {
          const rock = this.add.rectangle(x + cs/2, H - cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock);
          rock.body.setImmovable(true);
          this.boundaryRocks.add(rock);
          if (this.worldLayer) this.worldLayer.add(rock);
        }
      }
      
      // Left boundary rocks (allow specific gaps instead of removing entire side)
      for (let y = cs; y < H - cs; y += cs) {
        const gy = Math.floor((y - cs/2) / cs);
        if (this.isInEdgeGap(gy, skipLeftYs)) {
          continue; // gap for left edge door(s)
        }
        if (isShop) {
          // Double thickness for shop
          const rock1 = this.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock1);
          rock1.body.setImmovable(true);
          this.boundaryRocks.add(rock1);
          if (this.worldLayer) this.worldLayer.add(rock1);

          const rock2 = this.add.rectangle(cs + cs/2, y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock2);
          rock2.body.setImmovable(true);
          this.boundaryRocks.add(rock2);
          if (this.worldLayer) this.worldLayer.add(rock2);
        } else {
          const rock = this.add.rectangle(cs/2, y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock);
          rock.body.setImmovable(true);
          this.boundaryRocks.add(rock);
          if (this.worldLayer) this.worldLayer.add(rock);
        }
      }
      
      // Right boundary rocks (allow specific gaps instead of removing entire side)
      for (let y = cs; y < H - cs; y += cs) {
        const gy = Math.floor((y - cs/2) / cs);
        if (this.isInEdgeGap(gy, skipRightYs)) {
          continue; // gap for right edge door(s)
        }
        if (isShop) {
          // Double thickness for shop
          const rock1 = this.add.rectangle(W - (cs + cs/2), y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock1);
          rock1.body.setImmovable(true);
          this.boundaryRocks.add(rock1);
          if (this.worldLayer) this.worldLayer.add(rock1);

          const rock2 = this.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock2);
          rock2.body.setImmovable(true);
          this.boundaryRocks.add(rock2);
          if (this.worldLayer) this.worldLayer.add(rock2);
        } else {
          const rock = this.add.rectangle(W - cs/2, y + cs/2, cs, cs, 0x666666);
          this.physics.add.existing(rock);
          rock.body.setImmovable(true);
          this.boundaryRocks.add(rock);
          if (this.worldLayer) this.worldLayer.add(rock);
        }
      }

      // Add map-specific objects and items
      if (this.currentMap === 'overworld_01') {
        // Map 0: Original overworld map with weapons, shields, and shop
        // Clear stumps and tree trunks for this map
        this.treeTrunks.clear();
        this.stumps.clear();
        
        // Add the main bush using grid system - place at grid position (9, 5) 
        this.placeObjectOnGrid(9, 5, 'bush', this.mapBushes);
        
        // Place weapons using grid system for proper centering
        if (!this.collectedItems.meleeWeapon1) {
          this.meleeWeapon1 = this.placeObjectOnGrid(6, 6, 'weapon', null, {
            width: 12, height: 4, color: 0x888888,
            weaponType: 'basic', weaponName: 'Iron Pickaxe'
          });
        }

        if (!this.collectedItems.meleeWeapon2) {
          this.meleeWeapon2 = this.placeObjectOnGrid(7, 6, 'weapon', null, {
            width: 14, height: 4, color: 0xFFD700,
            weaponType: 'strong', weaponName: 'Golden Pickaxe'
          });
        }

        if (!this.collectedItems.meleeWeapon3) {
          this.meleeWeapon3 = this.placeObjectOnGrid(8, 6, 'weapon', null, {
            width: 10, height: 4, color: 0x00FFFF,
            weaponType: 'fast', weaponName: 'Crystal Pickaxe'
          });
        }

        // Place shields using grid system for proper centering
        if (!this.collectedItems.shield1) {
          this.shield1 = this.placeObjectOnGrid(12, 6, 'shield', null, {
            width: 10, height: 14, color: 0x654321,
            shieldType: 'basic', shieldName: 'Wooden Shield'
          });
        }

        if (!this.collectedItems.shield2) {
          this.shield2 = this.placeObjectOnGrid(13, 6, 'shield', null, {
            width: 12, height: 16, color: 0xC0C0C0,
            shieldType: 'strong', shieldName: 'Steel Shield'
          });
        }

        if (!this.collectedItems.shield3) {
          this.shield3 = this.placeObjectOnGrid(14, 6, 'shield', null, {
            width: 8, height: 12, color: 0x4169E1,
            shieldType: 'light', shieldName: 'Magic Shield'
          });
        }
        
      } else if (this.currentMap === 'overworld_02') {
        // Map 1: Second overworld map with organized bushes and tree trunks
        // Clear stumps for this map
        this.stumps.clear();
        
        // Place bushes in organized positions
        this.placeObjectOnGrid(6, 7, 'bush', this.mapBushes);  // Left bush
        this.placeObjectOnGrid(13, 11, 'bush', this.mapBushes); // Right bush
        
        // Place tree trunks in organized positions
        this.placeObjectOnGrid(10, 3, 'treeTrunkLarge', this.treeTrunks);   // Top center
        this.placeObjectOnGrid(5, 12, 'treeTrunkSmall', this.treeTrunks);   // Bottom left  
        this.placeObjectOnGrid(16, 8, 'treeTrunkMedium', this.treeTrunks);  // Right side
        
      } else if (this.currentMap === 'shop_01') {
        // Shop interior - smaller, more enclosed feeling
        this.treeTrunks.clear();
        this.stumps.clear();
        
        // Add shop counter (moved up due to thicker walls)
        this.shopCounter = this.placeObjectOnGrid(10, 8, 'treeTrunkLarge', this.treeTrunks);
        
        // Add some shop decorations (adjusted for smaller space)
        this.placeObjectOnGrid(6, 5, 'treeTrunkSmall', this.treeTrunks);   // Left decoration
        this.placeObjectOnGrid(14, 5, 'treeTrunkSmall', this.treeTrunks);  // Right decoration
        
        // Add side decorations
        this.placeObjectOnGrid(4, 8, 'treeTrunkSmall', this.treeTrunks);   // Left side
        this.placeObjectOnGrid(16, 8, 'treeTrunkSmall', this.treeTrunks);  // Right side
      }
      
  // Create doors for current map
  this.createDoorsForMap();

      // Set up collisions
      this.physics.add.collider(this.player, this.boundaryRocks);
      this.physics.add.collider(this.player, this.mapBushes);
      this.physics.add.collider(this.player, this.treeTrunks);
      this.physics.add.collider(this.player, this.buildingWalls);
      
      // Set up interactions for weapons and shields (only if they exist)
      if (this.meleeWeapon1) {
        this.physics.add.overlap(this.player, this.meleeWeapon1, this.pickupMeleeWeapon, null, this);
      }
      if (this.meleeWeapon2) {
        this.physics.add.overlap(this.player, this.meleeWeapon2, this.pickupMeleeWeapon, null, this);
      }
      if (this.meleeWeapon3) {
        this.physics.add.overlap(this.player, this.meleeWeapon3, this.pickupMeleeWeapon, null, this);
      }
      if (this.shield1) {
        this.physics.add.overlap(this.player, this.shield1, this.pickupShield, null, this);
      }
      if (this.shield2) {
        this.physics.add.overlap(this.player, this.shield2, this.pickupShield, null, this);
      }
      if (this.shield3) {
        this.physics.add.overlap(this.player, this.shield3, this.pickupShield, null, this);
      }
      
      // Update grid visualization if it's visible
      if (this.gridVisible) {
        this.createGridVisualization();
      }
    }

    createDoorsForMap() {
      // Get doors for current map (activeDoors already cleared in createMapObjects)
      const mapDoors = this.doorRegistry[this.currentMap] || {};
      const cs = this.gridCellSize;
      const maxGX = Math.floor(this.worldPixelWidth / cs) - 1;
      const maxGY = Math.floor(this.worldPixelHeight / cs) - 1;

      for (const [doorId, doorData] of Object.entries(mapDoors)) {
        // Building doors render as visible doors in the map interior/exterior
        if (doorData.type === 'building_entrance' || doorData.type === 'building_exit') {
          const doorContainer = this.placeObjectOnGrid(
            doorData.gridX,
            doorData.gridY,
            'shopDoor',
            null,
            { kind: doorData.type }
          );
          if (doorContainer) {
            doorContainer.doorId = doorId;
            this.activeDoors[doorId] = doorContainer;
            // Overlap on the physics-enabled rect child
            const sensor = doorContainer.doorRect;
            if (doorData.type === 'building_entrance') {
              this.physics.add.overlap(this.player, sensor, this.enterBuilding, () => !this.transitionLock, this);
              // Create shop building around the door (only for overworld shop entrance example)
              if (doorId === 'shop_door_01' && this.currentMap === 'overworld_01') {
                this.createShopBuilding(doorData.gridX, doorData.gridY);
              }
            } else {
              this.physics.add.overlap(this.player, sensor, this.exitBuilding, () => !this.transitionLock, this);
            }
          }
        } else if (
          doorData.type === 'edge_north' ||
          doorData.type === 'edge_south' ||
          doorData.type === 'edge_east' ||
          doorData.type === 'edge_west'
        ) {
          // Edge exits are invisible sensors near the border inside the map
          let gx = doorData.gridX, gy = doorData.gridY;
          // Validate placement on exterior wall for overworld maps
          if (this.maps[this.currentMap]?.type === 'overworld') {
            if (doorData.type === 'edge_north' && gy !== 0) {
              console.warn(`Door ${doorId} should be on north edge; clamping gy to 0 (was ${gy}).`);
              gy = 0;
            }
            if (doorData.type === 'edge_south' && gy !== maxGY) {
              console.warn(`Door ${doorId} should be on south edge; clamping gy to ${maxGY} (was ${gy}).`);
              gy = maxGY;
            }
            if (doorData.type === 'edge_west' && gx !== 0) {
              console.warn(`Door ${doorId} should be on west edge; clamping gx to 0 (was ${gx}).`);
              gx = 0;
            }
            if (doorData.type === 'edge_east' && gx !== maxGX) {
              console.warn(`Door ${doorId} should be on east edge; clamping gx to ${maxGX} (was ${gx}).`);
              gx = maxGX;
            }
          }
          let worldPos = this.gridToWorld(gx, gy);
          // Size sensor to exactly span the opened gap
          const r = this.edgeGapRadius ?? 1;
          const span = (2 * r + 1);
          let sensorW = 14, sensorH = 14, offX = 0, offY = 0;
          if (doorData.type === 'edge_east' || doorData.type === 'edge_west') {
            sensorW = this.gridCellSize;           // thin strip inside the map
            sensorH = this.gridCellSize * span;    // cover full vertical gap
            offX = (doorData.type === 'edge_west') ? this.gridCellSize * 0.25 : -this.gridCellSize * 0.25;
          } else {
            sensorW = this.gridCellSize * span;    // cover full horizontal gap
            sensorH = this.gridCellSize;           // thin strip inside the map
            offY = (doorData.type === 'edge_north') ? this.gridCellSize * 0.25 : -this.gridCellSize * 0.25;
          }
          const sensor = this.add.rectangle(worldPos.x + offX, worldPos.y + offY, sensorW, sensorH, 0x000000, 0);
          this.physics.add.existing(sensor);
          sensor.body.setImmovable(false);
          sensor.isEdgeExit = true;
          sensor.doorId = doorId;
          if (this.worldLayer) this.worldLayer.add(sensor);
          this.activeDoors[doorId] = sensor;
          this.physics.add.overlap(this.player, sensor, this.handleEdgeExit, () => !this.transitionLock, this);
        }
      }
    }

    createShopBuilding(doorGridX, doorGridY) {
      // Build shop structure around the door
      // Top wall with shop sign
      this.placeObjectOnGrid(doorGridX - 1, doorGridY - 2, 'buildingWall', this.buildingWalls);
      this.placeObjectOnGrid(doorGridX, doorGridY - 2, 'shopSign', this.buildingWalls); // Sign spans 2 cells
      this.placeObjectOnGrid(doorGridX + 1, doorGridY - 2, 'buildingWall', this.buildingWalls);
      
      // Fill gap between sign and door
      this.placeObjectOnGrid(doorGridX - 1, doorGridY - 1, 'buildingWall', this.buildingWalls); // Left wall
      this.placeObjectOnGrid(doorGridX, doorGridY - 1, 'buildingWall', this.buildingWalls); // Fill gap above door
      this.placeObjectOnGrid(doorGridX + 1, doorGridY - 1, 'buildingWall', this.buildingWalls); // Right wall
      
      // Side walls (only at door level)
      this.placeObjectOnGrid(doorGridX - 1, doorGridY, 'buildingWall', this.buildingWalls); // Left wall (door level)
      this.placeObjectOnGrid(doorGridX + 1, doorGridY, 'buildingWall', this.buildingWalls); // Right wall (door level)
    }

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
      if (this.isScrolling) return;
      this.beginTransition();

      // Freeze player during transition
      if (this.player && this.player.body) {
        this.player.body.setVelocity(0, 0);
        this.player.body.enable = false;
      }

      // Keep a reference to the old map layer
      const oldLayer = this.worldLayer;

  // Build the new map into a new layer without destroying the old
  const newLayer = this.add.container(0, 0);
  // Switch current map now (affects door graph, etc.)
  const targetColor = this.maps[newMapId].color;
  const startPlayerX = this.player ? this.player.x : 0;
  const startPlayerY = this.player ? this.player.y : 0;
  const endPlayerX = playerX;
  const endPlayerY = playerY;
  this.currentMap = newMapId;
  // Immediately set background color (no crossfade)
  this.cameras.main.setBackgroundColor(targetColor);

      // Temporarily assign worldLayer to newLayer and build contents into it
      this.worldLayer = newLayer;
      this.createMapObjects({ preserveExistingWorld: true, buildIntoExistingWorldLayer: true });

      // Position layers for the slide: new comes toward player, old moves away
      let fromX = 0, fromY = 0, toX = 0, toY = 0;
      const W = this.worldPixelWidth; const H = this.worldPixelHeight;
      if (direction === 'right') {
        // New content starts on the right and slides in; old slides out to the left
        newLayer.x = W;
        oldLayer.x = 0;
        toX = -W; // old target
      } else if (direction === 'left') {
        newLayer.x = -W;
        oldLayer.x = 0;
        toX = W;
      } else if (direction === 'down') {
        newLayer.y = H;
        oldLayer.y = 0;
        toY = -H;
      } else if (direction === 'up') {
        newLayer.y = -H;
        oldLayer.y = 0;
        toY = H;
      }

      // (Noise overlay removed per request)

      // Create parallel tweens for both layers and the player
      this.tweens.add({ targets: newLayer, x: 0, y: 0, duration: 750, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: oldLayer,
        x: toX,
        y: toY,
        duration: 750,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Dispose of the old content and finalize
          oldLayer.destroy(true);
          // Ensure new layer becomes the canonical world layer at origin
          newLayer.x = 0; newLayer.y = 0;
          this.worldLayer = newLayer;
          // (Noise overlay cleanup not needed)
          this.endTransition();
        }
      });
  // (Noise fade-in removed)

      // Tween the player's position to the landing spot to avoid instant teleport look
      if (this.player) {
        this.tweens.add({
          targets: this.player,
          x: endPlayerX,
          y: endPlayerY,
          duration: 750,
          ease: 'Sine.easeInOut'
        });
      }
    }

    // Centralize locking and input/physics freeze during transitions
    beginTransition() {
      this.isScrolling = true;
      this.transitionLock = true;
      if (this.player && this.player.body) {
        this.player.body.setVelocity(0, 0);
        this.player.body.enable = false;
      }
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = false;
      }
    }

    // Centralize unlock and key reset after transitions
    endTransition() {
      if (this.player && this.player.body) {
        this.player.body.enable = true;
        this.player.body.setVelocity(0, 0);
      }
      this.transitionLock = false;
      this.isScrolling = false;
      if (this.input && this.input.keyboard) {
        this.input.keyboard.enabled = true;
      }
      // Reset key states to avoid sticky movement
      if (this.keys) {
        for (const k of Object.values(this.keys)) {
          if (k && typeof k.reset === 'function') {
            k.reset();
          } else if (k) {
            // Fallback: clear basic flags if reset is not available
            k.isDown = false;
            k.isUp = true;
          }
        }
      }
    }

    takeDamage(amount) {
      this.health = Math.max(0, this.health - amount);
      // Update the UI Scene's health bar
      this.scene.get('UIScene').updateHealthBar(this.health, this.maxHealth);
      
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
      } else {
        console.log('Inventory full! Cannot pick up item.');
      }
    }

    swingMeleeWeapon() {
      if (!this.hasMeleeWeapon) {
        console.log('Cannot swing melee weapon - no weapon equipped!');
        return;
      }
      
      if (this.meleeWeaponSwinging) {
        console.log('Cannot swing melee weapon - already swinging!');
        return;
      }

      if (this.shieldRaised) {
        console.log('Cannot swing melee weapon - shield is raised! Lower shield first.');
        return;
      }
      
      this.meleeWeaponSwinging = true;
      console.log(`Swinging ${this.meleeWeaponName} in direction:`, this.lastDirection);
      
      // Get weapon properties from equipped weapon
      let weaponColor = 0xc0c0c0;
      let weaponSize = { width: 20, height: 4 };
      let swingDuration = 200;
      
      if (this.equippedWeapon) {
        weaponColor = this.equippedWeapon.color;
        weaponSize = this.equippedWeapon.size;
        swingDuration = this.equippedWeapon.swingDuration;
      } else {
        // Fallback to old method if no equipped weapon found
        switch (this.meleeWeaponType) {
          case 'basic':
            weaponColor = 0x888888;
            weaponSize = { width: 20, height: 4 };
            swingDuration = 200;
            break;
          case 'strong':
            weaponColor = 0xFFD700;
            weaponSize = { width: 24, height: 5 };
            swingDuration = 250;
            break;
          case 'fast':
            weaponColor = 0x00FFFF;
            weaponSize = { width: 16, height: 3 };
            swingDuration = 150;
            break;
        }
      }
      
      // Create or reuse weapon sprite for the swing animation
      if (!this.meleeWeaponSprite) {
        this.meleeWeaponSprite = this.add.rectangle(this.player.x, this.player.y - 15, weaponSize.width, weaponSize.height, weaponColor);
        this.meleeWeaponSprite.setOrigin(0, 0.5); // Pivot from the handle
        this.meleeWeaponSprite.setDepth(2); // Put weapon above player
      } else {
        // Update existing sprite properties
        this.meleeWeaponSprite.setSize(weaponSize.width, weaponSize.height);
        this.meleeWeaponSprite.setFillStyle(weaponColor);
      }
      
      // Show and position the weapon
      this.meleeWeaponSprite.setVisible(true);
      this.meleeWeaponSprite.x = this.player.x;
      this.meleeWeaponSprite.y = this.player.y;
      
      // Determine swing direction based on last movement or default to right
      let startAngle = -45;
      let endAngle = 45;
      
      // Adjust swing direction based on player's last direction
      if (this.lastDirection === 'left') {
        startAngle = -135;
        endAngle = -225;
      } else if (this.lastDirection === 'up') {
        startAngle = -135;
        endAngle = -45;
      } else if (this.lastDirection === 'down') {
        startAngle = 45;
        endAngle = 135;
      }
      
      this.meleeWeaponSprite.setRotation(Phaser.Math.DegToRad(startAngle));
      
      // Animate the weapon swing
      this.tweens.add({
        targets: this.meleeWeaponSprite,
        rotation: Phaser.Math.DegToRad(endAngle),
        duration: swingDuration,
        ease: 'Power2',
        onUpdate: () => {
          // Update weapon position during animation to follow player
          this.updateMeleeWeaponPosition();
        },
        onComplete: () => {
          this.meleeWeaponSprite.setVisible(false);
        }
      });
      
      // Check if weapon hits bushes (all bushes are now in mapBushes group)
      const allBushes = [];
      if (this.mapBushes) {
        this.mapBushes.children.entries.forEach(bush => {
          if (bush.active) {
            allBushes.push(bush);
          }
        });
      }
      
      allBushes.forEach(bush => {
        const distance = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          bush.x, bush.y
        );
        
        if (distance < 30) {
          // Remember bush position for stump placement
          const bushX = bush.x;
          const bushY = bush.y;
          
          // Destroy the bush
          bush.destroy();
          
          // Create a brown stump that can be walked over and add it to the stumps group
          const stump = this.add.circle(bushX, bushY, 8, 0x8B4513);
          stump.setDepth(-1); // Put stump behind everything else
          this.stumps.add(stump);
          // Note: No physics body added, so player can walk over it
          
          console.log('Cut down bush! Left behind a stump.');
        }
      });
      
      // Reset weapon swing after delay
      this.time.delayedCall(300, () => {
        this.meleeWeaponSwinging = false;
      });
    }

    raiseShield() {
      if (!this.hasShield) {
        console.log('Cannot raise shield - no shield equipped!');
        return;
      }

      if (this.meleeWeaponSwinging) {
        console.log('Cannot raise shield - currently swinging melee weapon! Wait for swing to finish.');
        return;
      }

      this.shieldRaised = true;
      
      // Get shield properties from equipped shield
      let shieldColor = 0x654321;
      let shieldSize = { width: 12, height: 16 };
      
      if (this.equippedShield) {
        shieldColor = this.equippedShield.color;
        shieldSize = this.equippedShield.size;
      } else {
        // Fallback to old method if no equipped shield found
        switch (this.shieldType) {
          case 'basic':
            shieldColor = 0x654321;
            shieldSize = { width: 12, height: 16 };
            break;
          case 'strong':
            shieldColor = 0xC0C0C0;
            shieldSize = { width: 14, height: 18 };
            break;
          case 'light':
            shieldColor = 0x4169E1;
            shieldSize = { width: 10, height: 14 };
            break;
        }
      }
      
      // Create shield sprite in front of player if it doesn't exist
      if (!this.shieldSprite) {
        this.shieldSprite = this.add.rectangle(0, 0, shieldSize.width, shieldSize.height, shieldColor);
        this.physics.add.existing(this.shieldSprite);
        this.shieldSprite.body.setImmovable(true);
      } else {
        // Update existing sprite properties
        this.shieldSprite.setSize(shieldSize.width, shieldSize.height);
        this.shieldSprite.setFillStyle(shieldColor);
        this.shieldSprite.body.setSize(shieldSize.width, shieldSize.height);
      }
      
      // Position shield in front of player based on facing direction
      this.updateShieldPosition();
      this.shieldSprite.setVisible(true);
      
      console.log('Shield raised - now blocking!');
    }

    lowerShield() {
      if (!this.hasShield) {
        console.log('Cannot lower shield - no shield equipped!');
        return;
      }
      this.shieldRaised = false;
      
      // Hide the shield sprite
      if (this.shieldSprite) {
        this.shieldSprite.setVisible(false);
        this.shieldSprite.body.enable = false; // Disable physics body
      }
      
      console.log('Shield lowered - no longer blocking');
    }

    updateShieldPosition() {
      if (!this.shieldSprite || !this.shieldRaised) return;
      
      // Enable physics body when shield is active
      this.shieldSprite.body.enable = true;
      
      // Position shield in front of player based on facing direction
      const offsetDistance = 15;
      
      switch (this.lastDirection) {
        case 'left':
          this.shieldSprite.x = this.player.x - offsetDistance;
          this.shieldSprite.y = this.player.y;
          break;
        case 'right':
          this.shieldSprite.x = this.player.x + offsetDistance;
          this.shieldSprite.y = this.player.y;
          break;
        case 'up':
          this.shieldSprite.x = this.player.x;
          this.shieldSprite.y = this.player.y - offsetDistance;
          break;
        case 'down':
          this.shieldSprite.x = this.player.x;
          this.shieldSprite.y = this.player.y + offsetDistance;
          break;
        default: // Default to right
          this.shieldSprite.x = this.player.x + offsetDistance;
          this.shieldSprite.y = this.player.y;
      }
    }

    updateMeleeWeaponPosition() {
      if (!this.meleeWeaponSprite || !this.meleeWeaponSwinging) return;
      
      // Keep weapon centered on player position during swing
      this.meleeWeaponSprite.x = this.player.x;
      this.meleeWeaponSprite.y = this.player.y;
    }

    // Inventory Management Methods
    addToInventory(item) {
      if (this.inventoryItems.length >= this.maxInventorySize) {
        return false; // Inventory full
      }
      this.inventoryItems.push(item);
      return true;
    }

    removeFromInventory(index) {
      if (index >= 0 && index < this.inventoryItems.length) {
        return this.inventoryItems.splice(index, 1)[0];
      }
      return null;
    }

    equipFromInventory(index) {
      if (index >= this.inventoryItems.length) {
        console.log('No item in that slot');
        return;
      }

      const item = this.inventoryItems[index];
      if (item.type === 'weapon') {
        this.equipWeapon(item);
        console.log(`Equipped ${item.name}`);
      } else if (item.type === 'shield') {
        this.equipShield(item);
        console.log(`Equipped ${item.name}`);
      }
    }

    equipWeapon(weaponItem) {
      // Unequip current weapon (put back in inventory if needed)
      if (this.equippedWeapon) {
        // Could add logic here to swap weapons
      }
      
      this.equippedWeapon = weaponItem;
      this.hasMeleeWeapon = true;
      this.meleeWeaponType = weaponItem.subtype;
      this.meleeWeaponName = weaponItem.name;
      
      // Update HUD weapon display safely
      const uiScene = this.scene.get('UIScene');
      if (uiScene && uiScene.scene.isActive()) {
        uiScene.updateWeaponDisplay({
          name: weaponItem.name,
          type: weaponItem.subtype
        });
      }
    }

    equipShield(shieldItem) {
      // Unequip current shield (put back in inventory if needed)
      if (this.equippedShield) {
        // Could add logic here to swap shields
      }
      
      this.equippedShield = shieldItem;
      this.hasShield = true;
      this.shieldType = shieldItem.subtype;
      this.shieldName = shieldItem.name;
      
      // Update HUD shield display safely
      const uiScene = this.scene.get('UIScene');
      if (uiScene && uiScene.scene.isActive()) {
        uiScene.updateShieldDisplay({
          name: shieldItem.name,
          type: shieldItem.subtype
        });
      }
    }

    toggleInventory() {
      this.inventoryOpen = !this.inventoryOpen;
      
      if (this.inventoryOpen) {
        this.showInventory();
      } else {
        this.hideInventory();
      }
    }

    showInventory() {
      // Create inventory panel
      if (!this.inventoryPanel) {
        // Make panel smaller since we removed equipment slots
        this.inventoryPanel = this.add.rectangle(160, 120, 300, 180, 0x333333, 0.8);
        this.inventoryPanel.setDepth(10);
        
        // Add title
        this.inventoryTitle = this.add.text(160, 50, 'INVENTORY', {
          fontSize: '16px',
          fill: '#ffffff',
          align: 'center'
        });
        this.inventoryTitle.setOrigin(0.5);
        this.inventoryTitle.setDepth(11);
        
        // Add main inventory slots
        this.inventorySlots = [];
        this.inventorySlotTexts = [];
        
        // Create 2 rows of 4 slots each for 8 total slots
        for (let i = 0; i < this.maxInventorySize; i++) {
          const row = Math.floor(i / 4);
          const col = i % 4;
          const x = 80 + (col * 40);
          const y = 100 + (row * 45); // Move up since no equipment slots
          
          // Slot background
          const slot = this.add.rectangle(x, y, 35, 35, 0x666666);
          slot.setDepth(11);
          this.inventorySlots.push(slot);
          
          // Slot number
          const slotNumber = this.add.text(x - 15, y - 15, `${i + 1}`, {
            fontSize: '12px',
            fill: '#ffffff'
          });
          slotNumber.setDepth(12);
          this.inventorySlotTexts.push(slotNumber);
        }
      }
      
      // Update inventory display
      this.updateInventoryDisplay();
      
      // Show all inventory UI elements
      this.inventoryPanel.setVisible(true);
      this.inventoryTitle.setVisible(true);
      this.inventorySlots.forEach(slot => slot.setVisible(true));
      this.inventorySlotTexts.forEach(text => text.setVisible(true));
    }

    hideInventory() {
      if (this.inventoryPanel) {
        this.inventoryPanel.setVisible(false);
        this.inventoryTitle.setVisible(false);
        this.inventorySlots.forEach(slot => slot.setVisible(false));
        this.inventorySlotTexts.forEach(text => text.setVisible(false));
        
        // Hide item displays
        if (this.inventoryItemDisplays) {
          this.inventoryItemDisplays.forEach(display => {
            if (display.sprite) display.sprite.setVisible(false);
            if (display.text) display.text.setVisible(false);
          });
        }
        
        // Hide equipment displays
        if (this.equipmentDisplays) {
          this.equipmentDisplays.forEach(display => {
            if (display.sprite) display.sprite.setVisible(false);
            if (display.text) display.text.setVisible(false);
          });
        }
      }
    }

    updateInventoryDisplay() {
      // Clean up existing item displays
      if (this.inventoryItemDisplays) {
        this.inventoryItemDisplays.forEach(display => {
          if (display.sprite) display.sprite.destroy();
          if (display.text) display.text.destroy();
        });
      }
      
      // Clean up existing equipment displays
      if (this.equipmentDisplays) {
        this.equipmentDisplays.forEach(display => {
          if (display.sprite) display.sprite.destroy();
          if (display.text) display.text.destroy();
        });
      }
      
      this.inventoryItemDisplays = [];
      this.equipmentDisplays = [];
      
      // Display items in main inventory with highlighting for equipped items
      for (let i = 0; i < Math.min(this.maxInventorySize, this.inventoryItems.length); i++) {
        const item = this.inventoryItems[i];
        const row = Math.floor(i / 4);
        const col = i % 4;
        const x = 80 + (col * 40);
        const y = 100 + (row * 45); // Match the adjusted grid position
        
        // Check if this item is currently equipped
        const isEquipped = (this.equippedWeapon && this.equippedWeapon === item) || 
                          (this.equippedShield && this.equippedShield === item);
        
        // Highlight slot if item is equipped
        if (isEquipped) {
          this.inventorySlots[i].setFillStyle(0x00FF00, 0.3); // Green highlight
        } else {
          this.inventorySlots[i].setFillStyle(0x666666); // Normal color
        }
        
        // Create item sprite in slot
        let itemSprite;
        if (item.type === 'weapon') {
          itemSprite = this.add.rectangle(x, y, item.size.width / 2, item.size.height * 2, item.color);
        } else if (item.type === 'shield') {
          itemSprite = this.add.rectangle(x, y, item.size.width, item.size.height, item.color);
        }
        itemSprite.setDepth(12);
        
        // Create item name text
        const itemText = this.add.text(x, y + 25, item.name, {
          fontSize: '8px',
          fill: isEquipped ? '#00FF00' : '#ffffff',
          align: 'center',
          wordWrap: { width: 35 }
        });
        itemText.setOrigin(0.5);
        itemText.setDepth(12);
        
        this.inventoryItemDisplays.push({
          sprite: itemSprite,
          text: itemText
        });
      }
    }

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
      // Launch UI Scene and wait for it to be ready
      this.scene.launch('UIScene');
      this.scene.get('UIScene').events.once('create', () => {
        this.scene.get('UIScene').updateHealthBar(this.health, this.maxHealth);
        
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
      this.input.keyboard.on('keydown-Z', () => {
        console.log('Z key pressed - attempting melee weapon attack');
        this.swingMeleeWeapon();
      });

      this.input.keyboard.on('keydown-X', () => {
        console.log('X key pressed - attempting shield raise');
        if (!this.shieldRaised) {
          this.raiseShield();
        }
      });

      this.input.keyboard.on('keyup-X', () => {
        console.log('X key released - lowering shield');
        if (this.shieldRaised) {
          this.lowerShield();
        }
      });

      this.input.keyboard.on('keyup-Z', () => {
        console.log('Z key released - attempting shield lower');
        if (this.shieldRaised) {
          this.lowerShield();
        }
      });

      this.input.keyboard.on('keydown-H', () => {
        console.log('H key pressed - taking debug damage');
        this.takeDamage(10);
      });

      this.input.keyboard.on('keydown-I', () => {
        console.log('I key pressed - toggling inventory');
        this.toggleInventory();
      });

      this.input.keyboard.on('keydown-P', () => {
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

    equipDefaultWeapon() {
      // Create a default weak weapon that doesn't need to be picked up
      const defaultWeapon = {
        type: 'weapon',
        subtype: 'starter',
        name: 'Rusty Dagger',
        color: 0x666666, // Dark gray for rusty appearance
        size: { width: 14, height: 3 },
        swingDuration: 350 // Slightly slower than basic weapon
      };
      
      // Add to inventory
      this.addToInventory(defaultWeapon);
      
      // Equip it immediately
      this.equipWeapon(defaultWeapon);
      
      console.log('Equipped default starter weapon: Rusty Dagger');
    }

    updateEquipmentHUD() {
      // Safely update the equipment display in the HUD
      const uiScene = this.scene.get('UIScene');
      if (!uiScene || !uiScene.scene.isActive()) {
        console.log('UIScene not ready for equipment update');
        return;
      }

      console.log('Updating equipment HUD - Weapon:', this.equippedWeapon?.name, 'Shield:', this.equippedShield?.name);

      // Update weapon display
      if (this.equippedWeapon) {
        uiScene.updateWeaponDisplay({
          name: this.equippedWeapon.name,
          type: this.equippedWeapon.subtype
        });
      } else {
        uiScene.updateWeaponDisplay({ name: 'None', type: 'none' });
      }

      // Update shield display  
      if (this.equippedShield) {
        uiScene.updateShieldDisplay({
          name: this.equippedShield.name,
          type: this.equippedShield.subtype
        });
      } else {
        uiScene.updateShieldDisplay({ name: 'None', type: 'none' });
      }
    }

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

class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
        this.healthStars = [];
        this.maxStars = 5; // 5 stars = 100 health (20 health per star)
        this.weaponSlot = null;
        this.shieldSlot = null;
        this.weaponIcon = null;
        this.shieldIcon = null;
        this.weaponLabel = null;
        this.shieldLabel = null;
    }

    create() {
        // Create health stars
        this.createHealthStars();
        
        // Create equipment indicators
        this.createEquipmentSlots();
        
        // Make sure UI stays on top
        this.scene.bringToTop();
        
        // Emit the create event to signal that the UI is ready
        this.events.emit('create');
    }

  createHealthStars() {
        this.healthStars = [];
        const starSize = 12;
        const starSpacing = 20;
        const startX = 20;
    const hudHeight = this.scene.get('MainScene')?.hudHeight || 32;
    const startY = 8; // within HUD band (top-left padding)

        for (let i = 0; i < this.maxStars; i++) {
            const x = startX + (i * starSpacing);
            
            // Create full star background (dark outline)
            const starBg = this.add.star(x, startY, 5, 4, 8, 0x444444);
            starBg.setScale(1.0);
            starBg.setScrollFactor(0);
            starBg.setDepth(1);
            starBg.setStrokeStyle(1, 0x222222);
            starBg.setAlpha(0.9); // 90% opacity
            
            // Create full star (gold)
            const fullStar = this.add.star(x, startY, 5, 4, 8, 0xFFD700);
            fullStar.setScale(0.9);
            fullStar.setScrollFactor(0);
            fullStar.setDepth(2);
            fullStar.setAlpha(0.9); // 90% opacity
            
            // Create half star using a graphics object for better control
            const halfStarGraphics = this.add.graphics();
            halfStarGraphics.setScrollFactor(0);
            halfStarGraphics.setDepth(2);
            halfStarGraphics.setAlpha(0.9); // 90% opacity
            
            this.healthStars.push({
                background: starBg,
                full: fullStar,
                half: halfStarGraphics,
                x: x,
                y: startY
            });
        }
    }

    createEquipmentSlots() {
    const slotSize = 16;
    const slotY = 8; // within HUD band
    const weaponSlotX = 130; // To the right of health stars
    const shieldSlotX = 150; // Next to weapon slot

        // Create weapon slot background
        this.weaponSlot = this.add.rectangle(weaponSlotX, slotY, slotSize, slotSize, 0x333333);
        this.weaponSlot.setScrollFactor(0);
        this.weaponSlot.setDepth(1);
        this.weaponSlot.setAlpha(0.9);

        // Create shield slot background  
        this.shieldSlot = this.add.rectangle(shieldSlotX, slotY, slotSize, slotSize, 0x333333);
        this.shieldSlot.setScrollFactor(0);
        this.shieldSlot.setDepth(1);
        this.shieldSlot.setAlpha(0.9);

        // Create weapon icon (initially hidden)
        this.weaponIcon = this.add.rectangle(weaponSlotX, slotY, 10, 3, 0x888888);
        this.weaponIcon.setScrollFactor(0);
        this.weaponIcon.setDepth(2);
        this.weaponIcon.setVisible(false);

        // Create shield icon (initially hidden)
        this.shieldIcon = this.add.rectangle(shieldSlotX, slotY, 8, 12, 0x654321);
        this.shieldIcon.setScrollFactor(0);
        this.shieldIcon.setDepth(2);
        this.shieldIcon.setVisible(false);

        // Create labels
    this.weaponLabel = this.add.text(weaponSlotX, slotY + 12, 'Z', {
            fontSize: '7px',
            fill: '#ffffff',
            align: 'center'
        });
        this.weaponLabel.setOrigin(0.5, 0);
        this.weaponLabel.setScrollFactor(0);
        this.weaponLabel.setDepth(1);
        this.weaponLabel.setAlpha(0.8);

    this.shieldLabel = this.add.text(shieldSlotX, slotY + 12, 'X', {
            fontSize: '7px',
            fill: '#ffffff',
            align: 'center'
        });
        this.shieldLabel.setOrigin(0.5, 0);
        this.shieldLabel.setScrollFactor(0);
        this.shieldLabel.setDepth(1);
        this.shieldLabel.setAlpha(0.8);
    }

    updateHealthBar(health, maxHealth) {
        if (!this.healthStars || this.healthStars.length === 0) {
            console.warn('Health stars not yet initialized');
            return;
        }
        
        const healthPerStar = maxHealth / this.maxStars; // 20 health per star
        const healthPercent = Math.max(0, Math.min(health / maxHealth, 1));
        const totalStarHealth = healthPercent * this.maxStars;
        
        for (let i = 0; i < this.maxStars; i++) {
            const star = this.healthStars[i];
            const starHealthNeeded = i + 1;
            
            // Clear previous half star drawing
            star.half.clear();
            
            if (totalStarHealth >= starHealthNeeded) {
                // Full star
                star.full.setVisible(true);
            } else if (totalStarHealth >= starHealthNeeded - 0.5) {
                // Half star - create a clipping effect
                star.full.setVisible(false);
                
                // Draw a full gold star first
                star.half.fillStyle(0xFFD700);
                star.half.fillStar(star.x, star.y, 5, 4, 8);
                
                // Then draw a dark rectangle over the right half
                star.half.fillStyle(0x444444);
                star.half.fillRect(star.x, star.y - 10, 10, 20);
            } else {
                // Empty star (just background)
                star.full.setVisible(false);
            }
        }
    }

    updateWeaponDisplay(weaponData) {
        console.log('UIScene: updateWeaponDisplay called with:', weaponData);
        
        if (!this.weaponIcon || !this.weaponLabel) {
            console.log('UIScene: Weapon UI elements not ready yet');
            return;
        }
        
        if (!weaponData || !weaponData.name || weaponData.name === 'None') {
            // No weapon equipped
            this.weaponIcon.setVisible(false);
            console.log('UIScene: Set weapon display to None');
            return;
        }

        // Show weapon icon with appropriate color and size
        this.weaponIcon.setVisible(true);
        
        // Set weapon color based on type
        let weaponColor = 0x888888; // Default gray
        if (weaponData.type === 'strong') weaponColor = 0xFFD700; // Gold
        else if (weaponData.type === 'fast') weaponColor = 0x00FFFF; // Cyan
        
        this.weaponIcon.setFillStyle(weaponColor);
        console.log('UIScene: Set weapon display to:', weaponData.name, 'with key Z');
    }

    updateShieldDisplay(shieldData) {
        if (!this.shieldIcon || !this.shieldLabel) {
            // UI not ready yet, skip update
            return;
        }
        
        if (!shieldData || !shieldData.name || shieldData.name === 'None') {
            // No shield equipped
            this.shieldIcon.setVisible(false);
            return;
        }

        // Show shield icon with appropriate color and size
        this.shieldIcon.setVisible(true);
        
        // Set shield color based on type
        let shieldColor = 0x654321; // Default brown
        if (shieldData.type === 'strong') shieldColor = 0xC0C0C0; // Silver
        else if (shieldData.type === 'light') shieldColor = 0x4169E1; // Blue
        
        this.shieldIcon.setFillStyle(shieldColor);
    }

    updateEquipmentDisplay(weaponData, shieldData) {
        this.updateWeaponDisplay(weaponData);
        this.updateShieldDisplay(shieldData);
    }
}

// Game configuration
const config = {
    type: Phaser.AUTO,
  width: 384,
  height: 352, // worldPixelHeight + hudHeight
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
            fps: 60,
            fixedStep: true
        }
    },
    scene: [MainScene, UIScene],
    pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2
  },
    fps: {
        target: 60,
        forceSetTimeOut: true,
        deltaHistory: 10,
        panicMax: 0,
        smoothStep: true
    },
    render: {
        antialias: false,
        pixelArt: true,
        roundPixels: true
    },
    loader: {
        maxParallelDownloads: 10
    }
};

// Create the game instance
const game = new Phaser.Game(config);