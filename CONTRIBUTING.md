# Contributing

Thanks for helping improve Gold Hunter! A couple of small habits make this codebase easier for both humans and AI assistants to navigate.

## PR Checklist

- [ ] Update docs/ai/index.json if you:
  - Add/rename/move modules or scenes in `src/`
  - Introduce new systems (e.g., new currency, enemy type, shop mechanics)
  - Add important functions worth direct linking
- [ ] Keep JSON valid (see docs/ai/schema.json); prefer small, specific anchors with `contains`
- [ ] Run the validator locally:
  - `npm run validate:ai` (or `node scripts/validate-ai-index.mjs`)
- [ ] Add brief notes in your PR description if you intentionally didn’t update the AI index

## Quick pointers

- AI index: docs/ai/index.json
- Guide: docs/ai/README.md
- Schema: docs/ai/schema.json
- Validation script: scripts/validate-ai-index.mjs

## Style & structure

- Keep modules focused and cohesive (`world.js` for placement/doors, `transitions.js` for movement/locks, etc.)
- Prefer pure helpers in `src/lib/` for testability and reuse

Happy hacking!
