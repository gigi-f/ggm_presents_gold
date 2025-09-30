# GGM presents GOLD

[![Play Now](https://img.shields.io/badge/Play%20Now-GitHub%20Pages-2ea44f?logo=github)](https://gigi-f.github.io/ggm_presents_gold/)

Top-down 2D action-adventure built with Phaser 3.

## Live Demo

- Play in your browser: https://gigi-f.github.io/ggm_presents_gold/

## Quickstart (local)

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open http://localhost:5173 (default Vite port)

For production build: `npm run build`

Notes:
- Built with Vite + TypeScript/JavaScript
- Works best in latest Chrome/Firefox

## Contributor Note (AI Index)

When you change code under `src/`, please update the AI index:

- Edit `docs/ai/index.json` to add new anchors or files
- Keep JSON valid; see `docs/ai/schema.json`
- Short guide: `docs/ai/README.md`

Validate locally:

- `npm run validate:ai`

More details in `CONTRIBUTING.md`.

## Project Structure

```
src/
├── game.ts                 # Game entry point, Phaser configuration
├── main.js                 # Main scene with game logic
├── constants.js            # Centralized constants and IDs
├── lib/                    # Core systems and utilities
│   ├── world.js           # World generation, objects placement
│   ├── enemies.js         # Enemy system and AI
│   ├── inventory.js       # Inventory management
│   ├── economy.js         # Currency and wallet system
│   ├── combat.js          # Combat mechanics
│   ├── buildings.js       # Procedural building generation
│   ├── transitions.js     # Map transitions and effects
│   └── ui.js             # UI helpers and modals
└── scenes/                # Game scenes
    ├── UIScene.js         # HUD and UI overlay
    └── TestScene.js       # Development testing scene
```

## Project Docs

- **Gameplay Manual**: `GAMEPLAY_MANUAL.md` - Complete guide for players
- Development Phases: `docs/development-phases.md`
- Engineering Guidelines: `.github/copilot-instructions.md` (Development Guidelines section)
