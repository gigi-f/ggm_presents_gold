/*
 AI-INDEX
 - Tags: engine.scenes, mechanics.inventory, mechanics.economy
 - See: docs/ai/index.json
*/
import Phaser from 'phaser';

export class UIScene extends Phaser.Scene {
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
        
        // Currency display elements
        this.currencyText = null;
        this.copperIngotIcon = null;
        this.silverIngotIcon = null;
    }

    create() {
        // Create health stars
        this.createHealthStars();
        
        // Create equipment indicators
        this.createEquipmentSlots();
        
        // Create currency display
        this.createCurrencyDisplay();
        
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

    createCurrencyDisplay() {
        const currencyX = 200; // Position to the right of equipment slots
        const currencyY = 8; // Same Y as other HUD elements
        
        // Currency text display
        this.currencyText = this.add.text(currencyX, currencyY, '0p', {
            fontSize: '8px',
            fill: '#ffffff',
            align: 'left'
        });
        this.currencyText.setOrigin(0, 0.5);
        this.currencyText.setScrollFactor(0);
        this.currencyText.setDepth(2);
        this.currencyText.setAlpha(0.9);
        
        // Small copper ingot icon
        this.copperIngotIcon = this.add.circle(currencyX + 25, currencyY, 3, 0xB87333);
        this.copperIngotIcon.setScrollFactor(0);
        this.copperIngotIcon.setDepth(2);
        this.copperIngotIcon.setAlpha(0.8);
        
        // Small silver ingot icon  
        this.silverIngotIcon = this.add.circle(currencyX + 35, currencyY, 4, 0xC0C0C0);
        this.silverIngotIcon.setScrollFactor(0);
        this.silverIngotIcon.setDepth(2);
        this.silverIngotIcon.setAlpha(0.8);
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
    
    updateCurrency(totalCurrency, copperCount, silverCount) {
        if (!this.currencyText) {
            // UI not ready yet, skip update
            return;
        }
        
        this.currencyText.setText(`${totalCurrency}p`);
        
        // Update icon visibility based on what's been collected
        if (this.copperIngotIcon) {
            this.copperIngotIcon.setAlpha(copperCount > 0 ? 1.0 : 0.3);
        }
        if (this.silverIngotIcon) {
            this.silverIngotIcon.setAlpha(silverCount > 0 ? 1.0 : 0.3);
        }
    }
}

