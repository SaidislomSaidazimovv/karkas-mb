# karkas-mb

Mebelchi — **Каркас (Construction) editor**. Mobile-first (Expo · React Native + react-native-web), driven by a headless TypeScript engine. Builds to a web bundle (netlify) and to native.

## Structure
- **`engine/`** — headless engine (UI-free): structural model (Block→Zone→Section→Instance), parametric solver (model → cuttable `Part[]`), SWJ008 (CNC) export. Vitest suite.
- **`ui/`** — the Expo app (the 3D editor). Bundles the engine, vendored into `ui/_engine` by `scripts/build-engine.mjs`.
- **`design/`** — the visual + functional spec (`CONSTRUCTION_FRAME_v3.md`) and HTML preview boards.

## Setup

```bash
# engine (repo root)
npm install
npm test            # engine correctness suite
npm run typecheck

# app
cd ui
npm install
node scripts/build-engine.mjs   # build engine -> vendor into ui/_engine
npm run web                     # run in the browser
# or: npx expo export -p web    # static build -> ui/dist (netlify-ready)
```

> Re-run `node scripts/build-engine.mjs` after any change under `engine/` so the app picks it up.
