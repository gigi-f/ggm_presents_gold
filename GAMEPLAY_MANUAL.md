# Gold Hunter - Gameplay Manual

## Table of Contents

1. [Game Overview](#game-overview)
2. [Controls](#controls)
3. [Game Mechanics](#game-mechanics)
4. [User Interface](#user-interface)
5. [Equipment System](#equipment-system)
6. [Combat System](#combat-system)
7. [Economy and Trading](#economy-and-trading)
8. [World and Exploration](#world-and-exploration)
9. [Save and Load](#save-and-load)
10. [Tips and Strategies](#tips-and-strategies)
11. [Troubleshooting](#troubleshooting)

---

## Game Overview

Gold Hunter is a top-down 2D action-adventure game where you play as a prospector exploring a vast world to collect gold and other valuable resources. Trade with merchants, fight enemies, equip better gear, and uncover the secrets of the world as you build your fortune.

### Objective
- Collect copper and silver ingots scattered throughout the world
- Trade with shopkeepers to upgrade your equipment
- Fight off enemies that threaten your progress
- Explore multiple interconnected zones
- Build wealth and become the ultimate gold hunter

---

## Controls

### Movement
- **Arrow Keys** (↑↓←→): Move your character in all four directions
- Movement speed is consistent, and diagonal movement is normalized for balanced gameplay

### Combat
- **Z Key**: Swing your melee weapon
  - Requires stamina to use
  - Cannot attack while shield is raised
  - Different weapon types have different swing speeds and damage
- **X Key** (Hold): Raise shield to block enemy attacks
  - Holding the shield drains stamina over time
  - Shield automatically lowers when stamina reaches zero
  - Blocks incoming damage from the front

### Interaction
- **C Key**: Interact with objects and NPCs
  - Talk to shopkeepers to open the trading interface
  - Activate doors and transitions between areas

### Inventory and Equipment
- **I Key**: Toggle inventory display
- **Number Keys (1-8)**: Quick-equip items from inventory slots
  - Press the number corresponding to the inventory slot
  - Automatically equips weapons and shields
  - Only works for compatible equipment

### Navigation and UI
- **M Key**: Toggle mini-map overlay
  - Shows current area layout
  - Displays doors, enemies, and NPCs
  - Shows your current position
  - Non-blocking overlay that allows continued gameplay

- **O Key**: Toggle world map overlay
  - Shows visited areas only (fog of war system)
  - Highlights your current location
  - Modal overlay that pauses gameplay

- **ESC Key**: Open/close pause menu
  - Pauses all game physics and animations
  - Provides access to save/load functionality
  - Use "Resume" to return to game

### Debug Controls (Development)
- **P Key**: Toggle grid visibility (for development)
- **H Key**: Damage player (for testing)

---

## Game Mechanics

### Health System
- You have a maximum of 100 health points (5 stars × 20 HP each)
- Health is displayed as stars in the top-left HUD
- Health regenerates slowly over time when not in combat
- Taking damage triggers brief invincibility frames to prevent spam damage
- Health can be restored using health potions purchased from shops

### Stamina System
- Maximum stamina of 100 points (displayed as a blue bar in the HUD)
- Stamina is consumed by:
  - Melee weapon attacks (15 stamina per swing)
  - Holding up your shield (continuous drain)
- Stamina regenerates automatically when not being used
- Actions requiring stamina are blocked when stamina is insufficient
- Shield automatically lowers when stamina reaches zero

### Player States
The game tracks different player states that affect available actions:
- **Normal**: Can move, attack, and interact freely
- **Combat**: Engaged with enemies, affecting certain interactions
- **Interacting**: Talking to NPCs or using objects
- **Transition Lock**: During map transitions, input is temporarily disabled

---

## User Interface

### HUD (Heads-Up Display)
The HUD is always visible during gameplay and shows:

- **Health Stars** (Top-left): 5 stars representing your health
- **Equipment Slots** (Top area): 
  - Weapon slot showing current equipped weapon and "Z" key indicator
  - Shield slot showing current equipped shield and "X" key indicator
- **Currency Display** (Top-right): 
  - Total currency value
  - Individual counts of copper and silver ingots
- **Stamina Bar** (Below health): Blue bar showing current stamina level

### Modal Interfaces

#### Inventory Screen
- Accessed with **I** key
- Shows up to 8 inventory slots (configurable size)
- Displays item names, types, and quick-equip numbers
- Use number keys 1-8 to quickly equip items from slots
- Close by pressing **I** again

#### Shop Interface
- Triggered by pressing **C** near a shopkeeper
- Full-screen modal showing available items
- Navigation:
  - **A/D Keys**: Browse items left/right
  - **C Key**: Purchase selected item (if you have enough currency)
  - **C Key**: Close shop when done
- Shows item prices in silver (s) and copper (c) denominations
- Displays your current wallet balance
- Automatic pagination if too many items to display

#### Pause Menu
- Accessed with **ESC** key
- Pauses all game physics and animations
- Options:
  - **Resume**: Return to game
  - **Save**: Save current progress
  - **Load**: Load previously saved game
- Close by selecting "Resume" or pressing **ESC** again

---

## Equipment System

### Weapon Types
The game features different melee weapon types with unique characteristics:

- **Starter Weapon**: Basic gray weapon, slow swing
- **Basic Weapon**: Standard gray weapon, moderate speed
- **Strong Weapon**: Gold-colored, high damage, slower swing (250ms duration)
- **Fast Weapon**: Cyan-colored, quick attacks, lower damage (150ms duration)

### Shield Types
Different shield types offer varying levels of protection:
- Shields must be actively raised with **X** key to block
- Blocking consumes stamina while held
- Different shield sizes and colors indicate their strength
- Shields position themselves based on your facing direction

### Equipment Stats
Items have the following properties:
- **Name**: Display name of the item
- **Type**: Category (weapon, shield, consumable)
- **Subtype**: Specific variant within the type
- **Size**: Physical dimensions affecting gameplay
- **Color**: Visual appearance and often indicates quality
- **Stats**: Damage, speed, or protection values

---

## Combat System

### Melee Combat
- **Attack Pattern**: Weapons swing in an arc in front of your character
- **Range**: Attacks hit enemies within the weapon's swing radius
- **Cooldown**: Each weapon has a swing duration before you can attack again
- **Stamina Cost**: Every attack consumes 15 stamina points

### Shield Combat
- **Active Blocking**: Shields must be actively raised to block damage
- **Directional Blocking**: Shields block attacks from the front-facing direction
- **Stamina Drain**: Holding a shield continuously drains stamina
- **Position Updates**: Shield position follows your movement and facing direction

### Enemy Types

#### Bat Enemies
- **Behavior**: Perch, chase players when in range, return to perch
- **Movement**: Flying movement pattern
- **AI**: Moderate aggro radius and deaggro distance

#### Slime Enemies  
- **Behavior**: Wander randomly, chase when player detected
- **Movement**: Ground-based sliding movement
- **AI**: Different aggro/deaggro ranges than bats

### Combat Mechanics
- **Knockback**: Enemies are knocked back when hit
- **Stun**: Enemies enter stunned state when damaged, with velocity dampening
- **Invincibility Frames**: Brief invulnerability after taking damage
- **Damage Feedback**: Visual and audio feedback when attacks connect

---

## Economy and Trading

### Currency System
The game uses a dual-currency system:

- **Copper Ingots**: Base currency worth 1 point each
- **Silver Ingots**: Premium currency worth 5 points each
- **Display**: Prices shown as combinations (e.g., "2s 3c" for 13 total value)

### Wallet Management
- **Automatic Collection**: Walking over currency automatically adds it to your wallet
- **Smart Spending**: System automatically uses optimal currency combinations
- **Real-time Updates**: HUD currency display updates immediately

### Shop System
- **Location**: Shops are found in dedicated shop zones
- **Interaction**: Approach shopkeeper and press **C** to trade
- **Available Items**:
  - Weapons (basic, strong, fast types)
  - Shields (various protection levels)  
  - Health potions (restore health)
  - Stamina tonics (restore stamina)
- **Auto-equip**: Purchased weapons and shields are automatically equipped
- **Inventory Storage**: Other items go to your inventory if there's space

### Pricing System
Items have fixed prices based on their type and quality:
- Basic items: Lower cost
- Strong/Fast items: Higher cost reflecting their benefits
- Consumables: Moderate prices for potions and tonics

---

## World and Exploration

### Map System
The world consists of multiple interconnected zones:

- **Overworld Zones**: Main exploration areas (overworld_00, overworld_01, overworld_02)
- **Shop Zone**: Special area with trading post (shop_01)
- **Transitions**: Doors and edges allow movement between zones

### Map Navigation

#### Mini-map (M Key)
- **Toggle**: Press **M** to show/hide
- **Content**: Shows doors, enemies, NPCs, and your position
- **Real-time**: Updates continuously as you move
- **Non-blocking**: Allows continued gameplay while displayed

#### World Map (O Key)
- **Toggle**: Press **O** to show/hide  
- **Fog of War**: Only shows areas you've visited
- **Current Location**: Highlights which zone you're currently in
- **Modal**: Pauses gameplay while displayed

### Exploration Elements
- **Currency Spawns**: Copper and silver ingots scattered throughout zones
- **Enemy Encounters**: Various creatures guard valuable areas
- **Interactive Objects**: Trees, buildings, and other objects to examine
- **Hidden Areas**: Some zones may require specific actions to access

---

## Save and Load

### Save System
- **Access**: Available through the Pause Menu (ESC key)
- **Storage**: Uses browser's localStorage for data persistence
- **Save Data Includes**:
  - Player position and current map
  - Health and stamina values
  - Complete wallet contents (total and individual currency counts)
  - Full inventory contents and equipped items
  - World exploration progress

### Load System
- **Access**: Available through the Pause Menu (ESC key)
- **Restoration**: Completely restores your game state
- **Overwrite Warning**: Loading will replace your current progress

### Data Persistence
- **Browser Storage**: Save files persist between browser sessions
- **Single Save Slot**: Game maintains one save file per browser
- **Cross-session**: Progress carries over when you close and reopen the game

---

## Tips and Strategies

### Combat Tips
- **Stamina Management**: Monitor your stamina carefully during fights
- **Shield Strategy**: Use shields defensively, but don't hold them too long
- **Weapon Choice**: Fast weapons for quick enemies, strong weapons for tough foes
- **Positioning**: Use knockback to control enemy positions

### Exploration Tips
- **Thorough Search**: Check every area for hidden currency spawns
- **Map Memory**: Use the world map to track where you haven't explored
- **Safe Areas**: Shops provide safe zones to recover and plan

### Economic Tips
- **Early Upgrades**: Prioritize better weapons and shields early
- **Currency Priority**: Silver ingots are worth 5x copper, seek them out
- **Smart Spending**: Plan purchases around your exploration needs

### Equipment Tips
- **Quick Equip**: Use number keys 1-8 for fast equipment changes mid-combat
- **Situational Gear**: Switch between fast and strong weapons based on enemies
- **Inventory Space**: Manage your 8-slot inventory efficiently

---

## Troubleshooting

### Performance Issues
- **Browser Compatibility**: Game works best in latest Chrome/Firefox
- **Frame Rate**: Game targets 60 FPS for smooth gameplay
- **Resource Usage**: Close other browser tabs if experiencing slowdowns

### Control Issues
- **Stuck Character**: Use arrow keys to move away from obstacles
- **Unresponsive Controls**: Check that no modal dialogs are open
- **Combat Issues**: Ensure stamina is sufficient for attacks

### Save/Load Issues
- **Browser Storage**: Ensure browser allows localStorage
- **Private/Incognito Mode**: Save data may not persist in private browsing
- **Multiple Tabs**: Close other game instances to prevent save conflicts

### Gameplay Issues
- **Missing UI**: Press ESC twice to reset interface
- **Shop Problems**: Ensure you're close enough to shopkeeper and press C
- **Map Transitions**: Walk to map edges or use doors to move between areas

### Debug Features
If you encounter issues during development:
- **Grid Display**: Press P to toggle grid overlay for positioning reference
- **Health Testing**: Press H to test damage systems (debug only)

---

## Version Information

This manual is current as of the latest game version and will be updated with each new release. For the most current information and updates, check the game's repository documentation.

### Recent Features Added
- Pause menu with save/load functionality
- Mini-map and world map overlays
- Enhanced combat system with stamina management
- Multiple enemy types (bats and slimes)
- Comprehensive shop system
- Equipment quick-equip system

---

*For technical support or to report bugs, please visit the game's GitHub repository.*