class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
        this.healthBar = null;
        this.healthBarBg = null;
    }

    create() {
        // Create health bar background (gray)
        this.healthBarBg = this.add.rectangle(10, 10, 104, 12, 0x333333);
        this.healthBarBg.setOrigin(0, 0);
        this.healthBarBg.setScrollFactor(0);

        // Create health bar (red)
        this.healthBar = this.add.rectangle(12, 12, 100, 8, 0xff0000);
        this.healthBar.setOrigin(0, 0);
        this.healthBar.setScrollFactor(0);

        // Make sure UI stays on top
        this.scene.bringToTop();
    }

    updateHealthBar(health, maxHealth) {
        // Calculate health percentage
        const healthPercent = Math.max(0, Math.min(health / maxHealth, 1));
        // Update health bar width
        this.healthBar.width = 100 * healthPercent;
    }
}

window.UIScene = UIScene;
