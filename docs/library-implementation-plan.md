# Implementation Plan: UI Consistency, Deterministic RNG, and Scalability Helpers

Last updated: 2025-09-30

This plan sequences low-risk, high-impact improvements to simplify code, improve consistency, and set up scalable foundations. It follows the project’s principles: vertical slices, small modules, stable contracts, and data-driven configs.

## Goals (Q4 2025)

- UI consistency and velocity: adopt a standard layout toolkit and shared theme tokens.
- Deterministic content: central RNG service with per-save and per-map streams.
- Data safety: validate external JSON data in dev.
- Organic world feel: noise-based density for terrain and spawns.
- Performance headroom: simple spatial queries for AI/effects.

## Scope and Deliverables

1) UI consistency (Rex UI or minimal NineSlice)
   - Theme tokens file (colors, spacing, fonts, radii).
   - UI wrapper helpers with a stable contract (panels, buttons, lists).
   - Migrate Pause Menu and Shop dialog as reference implementations.

2) RNG service
   - `rng.ts` with seeded streams per save and per map.
   - Swap ad-hoc RNG usage in biomes, buildings, maze decorations to the service.

3) Data validation (dev-only)
   - Ajv integration and thin validators for items and maps JSON using existing schemas.
   - Fail-fast in dev; warn in prod.

4) Noise fields (organic placement)
   - Seeded simplex-noise per map to modulate terrain (grass/marsh) and spawn densities.
   - Keep a feature flag to compare with current logic.

5) Spatial queries
   - Static rbush index for obstacles/props.
   - Convenience queries for “nearby” checks in AI/effects.

## Milestones and Order of Work

M1: Foundations and first UI slice (1–2 days)
- Add theme tokens (`src/ui/theme.ts`).
- Add RNG service (`src/lib/rng.ts`).
- Optional: Add Rex UI dependency and scaffolding (`src/ui/rex.ts`).
- Migrate Pause Menu to wrappers. Accept criteria below.

M2: Deterministic systems (1–2 days)
- Replace RNG in biomes/buildings/maze with `rng.ts` streams.
- Save/load: persist worldSeed and derive sub-seeds per system (already partially implemented for biome terrain).

M3: Data safety (0.5–1 day)
- Install Ajv; `dataValidation.ts` validates items/maps on boot (dev flag).
- Wire into asset load flow; surface errors with file and path pointers.

M4: Noise-driven density (1 day)
- Install `simplex-noise` and add `noise.ts` helper.
- Use a seeded noise field to vary tall grass and marsh densities; keep caps to preserve readability.

M5: Spatial index (1 day)
- Install `rbush`; index static props/obstacles after map build.
- Replace group scans in effects (e.g., rustle) or AI with spatial queries where beneficial.

## Acceptance Criteria

- UI
  - Pause Menu and Shop use the shared theme.
  - Layouts resize predictably; text wraps; no overlap at standard resolutions.
- RNG
  - Same save consistently reproduces terrain/enemy placements per map across runs.
  - Different saves yield different terrain/enemy distributions.
- Data validation
  - Invalid items/maps are flagged in dev with clear paths.
- Noise
  - Plains grass has visible but subtle density variation without blocking doors/mazes.
- Spatial queries
  - At least one system (e.g., rustle or AI perception) uses `rbush` instead of O(n) scans.

## Risks and Mitigations

- Rex UI footprint: Start with one screen; fallback to NineSlice-only if bundle size is a concern.
- RNG regressions: Introduce per-namespace streams; migrate module-by-module with toggles.
- Validation friction: Limit Ajv to dev by default; warn in prod.

## Implementation Notes

- Contracts
  - UI wrappers: `makePanel(scene, opts)`, `makeButton(scene, label, onClick)`, `makeList(scene, items, render)`.
  - RNG: `rngFor(scene, namespace, mapId?) -> () => number` plus helpers `randInt`, `choice`.
  - Validation: `validateItems(data)`, `validateMaps(data)` returning `{ valid, errors? }`.
- Feature flags
  - Add `scene.devFlags` with toggles: `useRexUI`, `validateData`, `useNoise`.

## Checklists

- [ ] Add theme tokens and wrappers; migrate Pause Menu
- [ ] Add RNG service; replace usages in biomes and buildings
- [ ] Add Ajv validation; wire to asset load
- [ ] Add simplex-noise; modulate tall grass/marsh density
- [ ] Add rbush; replace a hotspot scan
