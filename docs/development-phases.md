# Development Phases

Last updated: 2025-09-27

Recent changes (delta):
- **MAJOR: Complete Audio Integration System** - AudioManager with music transitions, spatial SFX, volume controls
- **MAJOR: Character Animation System** - CharacterAnimator with state-based movement, attack, and hit animations  
- **MAJOR: Particle System** - Environmental effects, combat feedback, visual polish with 6 particle types
- Audio: Background music changes by map type (overworld, shop, cave); fade in/out transitions
- Audio: Sound effects for all player actions (swing, shield, hit, pickup) with spatial positioning
- Audio: Enemy sounds (hit, death) with distance-based volume falloff  
- Audio: UI sounds for menus, doors, shop purchases with audio feedback
- Audio: Settings dialog in pause menu with volume sliders (Master, Music, SFX) and audio toggle
- Audio: Persistent settings saved to localStorage; performance-optimized with sound instance limits
- Animations: Smooth player movement with directional bob effects and idle breathing
- Animations: Attack animations with wind-up, strike, and recoil based on direction
- Animations: Hit/damage animations with screen shake and color effects
- Particles: Combat hit effects, weapon trails, currency sparkles, enemy death explosions
- Particles: Environmental dust for atmosphere, optimized with lifecycle management (200 particle limit)
- Fixed shopkeeper persistence: always re-created on shop entry; cleaned stale references on map rebuild so the NPC never disappears
- Implemented shopkeeper with full-screen shop UI (wallet display, item pricing, pagination, A/D nav, C to close)
- Added modular enemy system with a bat enemy; enemies freeze during transitions and respect combat
- Smooth scroll transitions between maps; edge sensors/doors; input/physics locks
- Combat: melee swings with arc hit, enemy HP, knockback/stun, shield block, player i-frames, feedback FX
- Economy: wallet with denominations, pricing, spending; HUD currency counters
- Removed outdated bush/stump system (objects, collisions, chop logic)
- Added Pause Menu (ESC toggles; physics/tweens pause/resume; modal uses unified UI; registry-gated)
- Added basic Stamina system (HUD bar, regen, drains: shield hold + melee swing cost, auto-lower on 0)
- Added Mini-map overlay (M toggle, HUD-aligned, shows doors + player; non-blocking)
- Mini-map: fixed right-wall alignment; added enemies/NPC markers; efficient per-frame updates
- Save/Load: added simple localStorage save/load via Pause Menu (position, map, HP/stamina, wallet, inventory, equipment)
- Enemy variety: added Slime enemy (wander + chase)
- Mini-map does NOT reveal gold/currency spawns to preserve exploration
- Overworld Map overlay (O): grid of zones with fog-of-war; only visited tiles visible; highlights current tile; modal with input gating
- Combat polish: consistent knockback for enemies from hit origin; player knockback on enemy hit; stunned enemies now dampen to a stop (no camera shake)
- GitHub Pages fixes: Vite base set to repo path; index entry script uses relative path

### Phase 1: Core Mechanics and MVP (First Vertical Slice)
- [x] Project Setup
  - Configure Phaser
  - Set up asset loading
  - Basic scene management
  - Git repository initialization

- [x] Basic Player Systems
  - Character movement and collision
  - Simple combat (melee/pickaxe swing)
  - Basic health system
  - Viewport transitions via container scroll (camera follow N/A for current slice)

- [x] Single Zone Implementation
  - Small overworld tiles with grid placement helpers
  - Collision boundaries (rocks/walls) and shop building
  - Simple interactive props (tree trunks); bushes removed
  - Basic enemy: bat with AI (perch, chase, return)
  - Currency collection (copper/silver ingots)

- [x] Essential UI
  - Health display (HUD)
  - Basic inventory (up to 8 slots), auto-equip on purchase
  - Currency counter (total & denominations)
  - [x] Simple pause menu

### Phase 2: Expanding Core Systems
- [~] Enhanced Player Mechanics
  - [x] Equipment system
    - [x] Weapon slots (melee types: basic/strong/fast)
    - [x] Shield mechanics (raise/lower, block, position)
    - [x] Tool usage (melee as tool)
  - [x] Stamina system (basic)
  - [x] Inventory expansion (configurable size; selection)
  - [~] Player states (normal, combat, interacting, transition lock)

- [x] Economy Foundation
  - Multiple currency types
    - [x] Copper ingots (common)
    - [x] Silver ingots (uncommon)
  - [x] Shop system (NPC dialog, pricing, purchase flow)
  - [x] Trading mechanics (spend wallet, auto-equip)

- [~] Combat Expansion
  - [x] Different weapon types (basic/strong/fast)
  - [x] Shield blocking
  - [~] Enemy variety (target 3–4 types; current: bat, slime)
  - [x] Damage system (enemy HP, knockback, stun)
  - [x] Hit detection and feedback (arc, numbers, puff FX)

- [ ] Save/Load System
  - [x] Player progress (position, map, HP/stamina)
  - [x] Inventory state (items, equipment)
  - [x] World state flags (visited tiles)
  - [x] Collected objects (shop items flags, currency IDs)

  - [ ] End goal / win condition
  - [ ] Collect the 11 gold bars

### Phase 3: World Building
- [~] Map System Design
  - [x] World map structure (IDs, door registry)
  - [x] Zone transitions (edge sensors, scroll transitions)
  - [x] Mini-map functionality (overlay HUD, door markers, player dot, enemies/NPCs; hides currency)
  - [x] Overworld Map (visited-only visibility, modal overlay)
  
- [ ] Zone Development (Iterative)
  1. Forest Zone (Starter Area)
    - [~] Basic enemies (bat)
    - [x] Initial currency ingots
    - [ ] Tutorial elements
  
  2. Village Zone (Trading Hub)
    - [x] Shopkeeper NPC and shop interior
    - [ ] Quest givers
    - [ ] Safe zone mechanics
  
  3. Cave System
     - Darkness mechanics
     - Mining gameplay
     - Stronger enemies
  
  4. Mountain Area
     - Vertical level design
     - Weather effects
     - Mini-bosses
  
  5. Secret Areas
     - Hidden passages
     - Puzzle rooms
     - Special rewards

### Phase 4: Content and Systems Integration
- [~] Item System Completion
  - Equipment
    - [x] Multiple melee weapon types
    - [ ] Armor varieties
    - [ ] Special tools
  - Consumables
    - [ ] Health potions
    - [ ] Stamina items
    - [ ] Special effect items
  - Treasure system
    - [ ] Chest mechanics
    - [ ] Hidden item spots
    - [ ] Rare item spawns

- [~] NPC Systems
  - [x] Shopkeeper AI (static merchant)
  - [x] Dialog system (modal, pagination)
  - [x] Trading mechanics (purchase, affordability checks)
  - [ ] Quest system
  - [ ] Hint system

- [~] Enemy Variety
- [ ] Zone-specific enemies
  - Patrol patterns
  - Advanced AI behaviors
  - Boss encounters
  - Enemy drops

### Phase 5: Polish and Enhancement
- [~] Visual Improvements
  - [x] Character animations (idle, walking, attacking, hit reactions)
  - [x] Environmental effects (atmospheric dust particles, ambient world effects)
  - [x] Particle systems (combat feedback, currency sparkles, death effects)
  - [x] UI polish (shop overlay, affordability, word-wrap)
  - [x] Transition effects (scroll, freeze enemies)

- [x] Audio Integration
  - [x] Background music (context-aware, smooth transitions)
  - [x] Sound effects
    - [x] Player actions (swing, shield, movement feedback)
    - [x] Enemy sounds (hit, death with spatial audio)
    - [x] Environmental audio (pickup sounds, door transitions)
  - [x] Audio mixing (volume controls, settings persistence)
  - [x] Dynamic audio system (map-based music, spatial positioning)

- [ ] Additional Features
  - Weather system
  - Day/night cycle
  - Achievement system
  - Speed-run mode
  - Local high scores

### Phase 6: Testing and Optimization
- [ ] Performance Optimization
  - Asset loading
  - Physics calculations
  - Memory management
  - Frame rate stability

- [ ] Quality Assurance
  - Playtesting
  - Bug fixing
  - Balance adjustments
  - Cross-browser testing

### Phase 7: Documentation and Launch
- [~] Documentation
  - Code documentation
  - [ ] API reference
  - [ ] Game design document
  - [x] User manual (GAMEPLAY_MANUAL.md)
  - [ ] Troubleshooting guide

- [ ] Launch Preparation
  - Version control
  - Build process
  - Deployment strategy
  - Post-launch support plan

Housekeeping
- [x] Keep `docs/ai/index.json` anchors in sync with code changes
- [x] Update `.github/copilot-instructions.md` for guidelines and module contracts when interfaces change
- [x] Reflect directory structure changes in `README.md` and `CONTRIBUTING.md`
- [x] Remove obsolete/duplicate files (cleaned up old scene files)
- [x] Add missing AI-INDEX tags to core files
