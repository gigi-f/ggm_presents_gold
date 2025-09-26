# Troubleshooting Guide

## Common Issues and Solutions

### Physics and Collision Issues
**Symptoms**:
- Objects pass through each other
- Collisions not working
- Objects getting stuck

**Solutions**:
1. For static obstacles (like walls, bushes):
```javascript
// Make the object immovable
object.body.setImmovable(true);

// Add collision with player
this.physics.add.collider(this.player, object);
```

2. For overlap detection (item pickup, triggers):
```javascript
// Use overlap instead of collider
this.physics.add.overlap(this.player, item, () => {
    // Handle pickup/trigger
}, null, this);
```

3. Common mistakes to check:
- Ensure both objects have physics bodies (`this.physics.add.existing(object)`)
- Check if objects are in the same physics group/layer
- Verify `setImmovable()` is set correctly for static objects
- Make sure collision isn't disabled (`body.enable = true`)


### 1. Keyboard Input Issues
**Symptoms**: 
- Keys not responding consistently
- Input lag
- Keys getting "stuck"
- Multiple triggers from single press

**Solutions**:
1. Use `Key` objects for all keyboard inputs:
```javascript
// ❌ Don't use raw keyboard events
this.input.keyboard.on('keydown-SPACE', () => {...});

// ✅ Do create Key objects in create()
this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
```

2. Choose the right input check method:
```javascript
// For single press actions (like attacking):
if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {...}

// For continuous actions (like movement):
if (this.keySpace.isDown) {...}

// For key release actions:
if (Phaser.Input.Keyboard.JustUp(this.keySpace)) {...}
```

3. Create all key objects at once in create():
```javascript
create() {
    this.keys = {
        up: this.input.keyboard.addKey('W'),
        down: this.input.keyboard.addKey('S'),
        left: this.input.keyboard.addKey('A'),
        right: this.input.keyboard.addKey('D'),
        attack: this.input.keyboard.addKey('SPACE')
    };
}
```

4. Clean up in shutdown():
```javascript
shutdown() {
    // Remove key bindings when scene ends
    this.input.keyboard.removeKey(this.keySpace);
}
```

### 2. "Cannot read properties of null (reading 'isParent')"
**Cause**: Attempting to create physics overlaps or interactions with game objects before they are created.
**Solution**: Ensure physics objects and their overlaps are created in the correct order. Create game objects before setting up their physics interactions.

Example:
```javascript
// ❌ Wrong order - player doesn't exist yet
this.physics.add.overlap(this.player, this.item, ...);
this.player = this.add.circle(160, 120, 8, 0xffff00);

// ✅ Correct order
this.player = this.add.circle(160, 120, 8, 0xffff00);
this.physics.add.existing(this.player);
this.physics.add.overlap(this.player, this.item, ...);
```

## Best Practices

1. **Object Creation Order**
   - Create game objects before setting up their interactions
   - Add physics to objects before creating overlaps or collisions
   - Initialize input handlers after relevant objects exist

2. **Input Handling**
   - Prefer Phaser's polling for input (`this.input.keyboard.addKey()`) over event listeners for consistent behavior
   - Check if objects exist before accessing their properties

3. **Scene Management**
   - Initialize all object references in constructor
   - Create objects in proper dependency order in `create()`
   - Clean up objects and event listeners in `shutdown()`