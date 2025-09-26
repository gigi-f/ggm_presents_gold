import Phaser from 'phaser';

export class TestScene extends Phaser.Scene {
  constructor() {
    super('TestScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(0x333333);
    const txt = this.add.text(10, 10, 'TestScene: sandbox for experiments', { fontSize: '12px', color: '#fff' });
    txt.setScrollFactor(0);

    // Simple controllable dot to test inputs
    this.dot = this.add.circle(160, 160, 6, 0xffff00);
    this.physics.add.existing(this.dot);

    this.keys = this.input.keyboard.addKeys('LEFT,RIGHT,UP,DOWN');
  }

  update() {
    if (!this.dot || !this.dot.body) return;
    const b = this.dot.body;
    b.setVelocity(0);
    const s = 120;
    if (this.keys.LEFT.isDown) b.setVelocityX(-s);
    else if (this.keys.RIGHT.isDown) b.setVelocityX(s);
    if (this.keys.UP.isDown) b.setVelocityY(-s);
    else if (this.keys.DOWN.isDown) b.setVelocityY(s);
  }
}


export class CurrencySystem {
    constructor(scene) {
        this.scene = scene;
        this.copperCount = 0;
        this.silverCount = 0;
        this.totalValue = 0;
        
        this.createHUD();
    }

    createHUD() {
        // Currency display in top-left corner
        this.currencyText = this.scene.add.text(10, 30, this.getCurrencyDisplay(), {
            fontSize: '14px',
            color: '#ffdd44',
            backgroundColor: '#000000aa',
            padding: { x: 8, y: 4 }
        });
        this.currencyText.setScrollFactor(0);
        this.currencyText.setDepth(100);
    }

    getCurrencyDisplay() {
        return `Total: ${this.totalValue}p (Cu: ${this.copperCount}, Ag: ${this.silverCount})`;
    }

    addCopper(amount = 1) {
        this.copperCount += amount;
        this.updateTotal();
        this.showPickupEffect('Copper +' + amount, 0xcd7f32);
    }

    addSilver(amount = 1) {
        this.silverCount += amount;
        this.updateTotal();
        this.showPickupEffect('Silver +' + amount, 0xc0c0c0);
    }

    updateTotal() {
        this.totalValue = (this.copperCount * 1) + (this.silverCount * 5);
        this.currencyText.setText(this.getCurrencyDisplay());
    }

    showPickupEffect(text, color) {
        const effectText = this.scene.add.text(this.scene.cameras.main.centerX, this.scene.cameras.main.centerY - 50, text, {
            fontSize: '16px',
            color: `#${color.toString(16)}`
        });
        effectText.setOrigin(0.5);
        effectText.setScrollFactor(0);
        
        this.scene.tweens.add({
            targets: effectText,
            y: effectText.y - 30,
            alpha: 0,
            duration: 1000,
            onComplete: () => effectText.destroy()
        });
    }

    // Environmental interaction - call this when player interacts with bushes, etc.
    rollForDrop() {
        const roll = Math.random();
        if (roll < 0.05) { // 5% chance for silver (very rare)
            this.addSilver(1);
            return 'silver';
        } else if (roll < 0.25) { // 20% chance for copper (rare)
            this.addCopper(1);
            return 'copper';
        }
        return null;
    }
}

export class DebugSystem {
    constructor(scene, currencySystem) {
        this.scene = scene;
        this.currencySystem = currencySystem;
        this.setupDebugKeys();
    }

    setupDebugKeys() {
        this.debugKeys = this.scene.input.keyboard.addKeys('MINUS,EQUAL');
    }

    update(playerX, playerY) {
        if (Phaser.Input.Keyboard.JustDown(this.debugKeys.MINUS)) {
            this.dropCopperIngot(playerX, playerY);
        }
        
        if (Phaser.Input.Keyboard.JustDown(this.debugKeys.EQUAL)) {
            this.dropSilverIngot(playerX, playerY);
        }
    }

    dropCopperIngot(x, y) {
        const ingot = this.scene.add.circle(x + 20, y, 4, 0xcd7f32);
        this.scene.physics.add.existing(ingot);
        
        // Add pickup interaction
        this.scene.physics.add.overlap(this.scene.dot, ingot, () => {
            this.currencySystem.addCopper(1);
            ingot.destroy();
        });
    }

    dropSilverIngot(x, y) {
        const ingot = this.scene.add.circle(x + 20, y, 4, 0xc0c0c0);
        this.scene.physics.add.existing(ingot);
        
        // Add pickup interaction
        this.scene.physics.add.overlap(this.scene.dot, ingot, () => {
            this.currencySystem.addSilver(1);
            ingot.destroy();
        });
    }
}

// Press "T" anywhere to start the TestScene.
// You can still call bindTestSceneHotkey(game) manually, but it will self-bind automatically.
export function bindTestSceneHotkey(game, key = 'T') {
    const handler = (e) => {
        if (String(e.key).toUpperCase() !== String(key).toUpperCase()) return;
        e.preventDefault();

        const g = game || (Phaser && Phaser.GAMES && Phaser.GAMES[0]);
        if (!g) return;

        const mgr = g.scene;
        let exists = false;
        try { exists = !!mgr.getScene('TestScene'); } catch (_) { exists = false; }
        if (!exists) mgr.add('TestScene', TestScene, false);

        if (mgr.isActive('TestScene')) {
            mgr.bringToTop('TestScene');
        } else {
            mgr.start('TestScene');
        }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
}
// Auto-bind once when this module is loaded (works without passing the game instance)
if (typeof window !== 'undefined') {
    window.__TEST_SCENE_HOTKEY__ = window.__TEST_SCENE_HOTKEY__ || bindTestSceneHotkey();
}