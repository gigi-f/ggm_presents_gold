# AI Code Index & Tagging

This folder contains a machine-readable index to help AI tools and new contributors find key systems quickly.

- Index: `docs/ai/index.json` (DO NOT break JSON format)
- Schema: `docs/ai/schema.json`

## What to tag

Add or update an anchor when you:
- Add a new system (module or scene) worth discovering fast
- Rename/move files referenced by existing tags
- Add new features to existing systems (e.g., new currency, weapon type)

## How to edit

1. Keep entries minimal but useful. Prefer 2–5 anchors per tag.
2. Use `contains` to list function/class/identifier names present in the file.
3. Avoid regex; use simple strings. Example:

{
  "id": "mechanics.economy",
  "label": "Economy (currencies, wallet, HUD)",
  "files": ["src/lib/economy.js", "src/lib/world.js"],
  "anchors": [
    { "file": "src/lib/economy.js", "contains": ["CURRENCIES", "addToWallet"] }
  ]
}

4. Update `entryPoints` when you add top-level modules or scenes.
5. Bump the `version` or at least update the `updated` date.

## When to update (CI-friendly reminder)

- Any PR that changes files under `src/` SHOULD update `docs/ai/index.json`.
- If unsure, at least add a comment in the PR noting why it’s unchanged.

## Rationale

This index keeps search-time small for both humans and AI, making it easier to maintain velocity as the project grows.
