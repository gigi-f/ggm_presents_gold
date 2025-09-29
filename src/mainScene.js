class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.currentMap = 0;
    this.maps = [
      { color: 0x228be6, exits: { right: 1 } },
      { color: 0x51cf66, exits: { left: 0 } }
    ];
    this.player = null;
  }

  preload() {}

  create() {
    this.cameras.main.setBackgroundColor(this.maps[this.currentMap].color);
  // Create a yellow circle as the player sprite
  this.player = this.add.circle(160, 120, 8, 0xffff00);
  this.physics.add.existing(this.player);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.speed = 100;
  }

  update(time, delta) {
    const body = this.player.body;
    body.setVelocity(0);
    if (this.cursors.left.isDown) body.setVelocityX(-this.speed);
    else if (this.cursors.right.isDown) body.setVelocityX(this.speed);
    if (this.cursors.up.isDown) body.setVelocityY(-this.speed);
    else if (this.cursors.down.isDown) body.setVelocityY(this.speed);

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

window.MainScene = MainScene;
