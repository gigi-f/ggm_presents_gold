# Extensibility Plan: Maps, Doors, and Items

This document outlines a pragmatic refactor path to scale the map and item systems with game-dev best practices, while keeping the current prototype playable.

## Current risks and bottlenecks

- Content hard-coded in scene logic
  - Map data, exits, doors, and objects are created via large if/else blocks in `createMapObjects()`. This couples content and logic and makes content iteration slow.
- Ad-hoc cleanup and scanning `children`
  - The scene destroys miscellaneous objects by scanning `this.children.list` and checking ad-hoc flags (e.g., `isShopDoor`). This is fragile and O(N) on every map change.
- Mixed responsibilities in one scene
  - The main scene handles: world state, map building, door linking, item spawning, input, combat, UI signals, etc.
- Items tracked by booleans and implicit IDs
  - `collectedItems` uses per-item booleans. This won’t scale across many maps, re-entries, or save/load.
- Overlap re-trigger hazards
  - Door overlaps are immediate re-trigger risks; positioning hacks work, but you also want debounce/cooldown and disable/re-enable on transition.
- Geometry-only world
  - Building world geometry from rectangles is great for a slice, but scaling content is easier with Tilemaps + object layers (Tiled) and data-driven spawn.

## Target architecture (data-driven)

- Map data externalized (JSON or Tiled)
  - Define maps, exits, doors, spawn points, and object placement outside code.
  - Keep a small loader that translates data -> Phaser objects.
- Prefabs/Factories for world objects
  - Door, Item, NPC, etc. as classes (Containers) with clear lifecycle. Factories create and register them in groups for bulk cleanup.
- Group-based cleanup and ownership
  - A single `worldLayer` Container (or Group) is the parent of all map objects. On transition, destroy `worldLayer` to clean everything deterministically.
- Stable IDs for items and doors
  - Items and doors have unique IDs. World state stores collected/consumed/spawned flags by ID.
- Event-driven UI and systems
  - Use an EventEmitter to decouple UI Scene and world logic (pickup, damage, equip, gold changes, etc.).
- Save/Load friendly state
  - Player state, inventory, map id, and world flags serialize cleanly. Hydrate on load.

## Data model (high level)

- maps.json
  - Per map: meta (type, color/tilemap), exits, doors array, object spawns array (by type and id).
- items.json
  - Master item definitions by `id`: category (weapon/shield/consumable), stats, sprite keys, physics config.

See `src/data/*.example.json` for concrete examples.

## Phaser patterns to prefer

- Tilemaps with object layers
  - Author in Tiled (doors, spawns, colliders). Load via `this.make.tilemap`, build collision layers, iterate object layers for doors/items.
- Containers for composite objects
  - A `Door` extends `Container` holding sprites/sensors; it handles its own overlap enabling/disabling and cleanup (destroy children on `destroy`).
- Physics Groups and parent containers
  - Keep `doorsGroup`, `itemsGroup`, `worldLayer`. On transition, `worldLayer.destroy(true)` and recreate.
- Transition guard
  - Add a `this.transitionLock = true` during transitions; unlock after player is placed and a small delay. Also disable door sensors during the lock.

## Incremental refactor roadmap

1) Introduce a `worldLayer` container
   - Parent all map objects to `worldLayer`. Replace manual `children` scans with `worldLayer.destroy(true)` on transition.
2) Extract map and door data
   - Move current inline `maps` and `doorRegistry` into JSON (`src/data/maps.json`). Keep a fallback to embedded data to avoid breakage while wiring.
3) Add prefabs/factories
   - Create `Door` and `Item` factories that attach to `doorsGroup`/`itemsGroup` and parent to `worldLayer`. Link `doorId`, `targetMap`, `targetDoor` via `setData`.
4) Unique IDs and world state
   - Items placed in map data require stable `id`. Replace booleans with a `worldState.collectedItemIds` Set.
5) Map loader
   - `MapLoader.loadMap(mapId)` parses JSON/Tiled and populates the world. `WorldManager.transitionTo(mapId, spawnPoint)` handles cleanup, lock, and camera/FX.
6) Optional: Tiled migration
   - Add `.tmx/.json` tilemaps, define `Doors` and `Spawns` object layers. Update loader to read from Tilemap data instead of the custom JSON objects.

## Testing & QA

- Unit: parsing map JSON and door graph validation (each door’s target exists).
- Integration: transition debounce test, items collected persist across re-entry, group cleanup leaves no orphans.
- Performance: spawn 100+ items and 50+ doors in a sandbox; ensure 60fps and no leaks on repeated transitions.

## Risks and mitigations

  - Mitigation: Keep a single codepath (loader) per feature as soon as it’s ready; retire old inline map blocks quickly.
  - Mitigation: Validate map JSON at load (schema-based or manual checks), log helpful errors with map IDs and coordinates.


Short-term wins that don’t break current code:
 - Make edge entrances data-driven with `entranceHalfWidth` per door. World boundary builder leaves exact-width gaps; sensors are sized to match, ensuring perfect alignment and easy customization.
