class MainScene extends Phaser.Scene {
  shieldRaised = false;
  shieldKey = null;
  shieldSprite = null;
  hasShield = false;
  shield = null;
  inventoryItems = [];
  inventorySelected = 0;
  inventoryOpen = false;
  inventoryPanel = null;
  inventoryKey = null;
  hudSwordIcon = null;
  hudEmptyIcon = null;
  lastHudState = null;
  lastDirection = 'right'; // right, left, up, down
  hasSword = false;
  sword = null;
  swordAttack = null;
  swordKey = null;
  debugText = null;
  swordSwingAngle = 0;
  swordSwinging = false;
  health = 100;
  maxHealth = 100;

  constructor() {
    super('MainScene');
    this.currentMap = 0;
    this.maps = [
      { color: 0x228be6, exits: { right: 1 } },
      { color: 0x51cf66, exits: { left: 0 } }
    ];
    this.player = null;
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    // Update the UI Scene's health bar
    this.scene.get('UIScene').updateHealthBar(this.health, this.maxHealth);
    
    // Flash the player red when taking damage
    this.player.setTint(0xff0000);
    this.time.delayedCall(200, () => {
      this.player.clearTint();
    });
    
    // Check for death
    if (this.health <= 0) {
      // Handle player death here
      console.log('Player died!');
    }
  }

  preload() {}

  create() {
    // Launch UI Scene
    this.scene.launch('UIScene');
    this.scene.get('UIScene').updateHealthBar(this.health, this.maxHealth);

    // Initialize all keyboard inputs
    this.keys = {
      inventory: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I),
      sword: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      shield: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN)
    };

    // Set up the game world
    this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
    this.player = this.add.circle(160, 120, 8, 0xffff00);
    this.physics.add.existing(this.player);
  }

  update(time, delta) {
    if (!this.player) return;

    const body = this.player.body;
    body.setVelocity(0);

    // Handle movement
    if (this.keys.left.isDown) body.setVelocityX(-100);
    else if (this.keys.right.isDown) body.setVelocityX(100);
    if (this.keys.up.isDown) body.setVelocityY(-100);
    else if (this.keys.down.isDown) body.setVelocityY(100);

    // Map transition logic
    if (this.player.x > 320 && this.maps[this.currentMap].exits.right !== undefined) {
      this.currentMap = this.maps[this.currentMap].exits.right;
      this.player.x = 0;
      this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
    } else if (this.player.x < 0 && this.maps[this.currentMap].exits.left !== undefined) {
      this.currentMap = this.maps[this.currentMap].exits.left;
      this.player.x = 320;
      this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
    }
  }
}