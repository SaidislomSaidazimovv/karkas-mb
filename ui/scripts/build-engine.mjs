// ui/scripts/build-engine.mjs — rebuild the engine and vendor it into ui/_engine.
//
// The Expo app bundles the engine as in-project JS (ui/_engine) because metro won't
// resolve a sibling package outside the project root. Run this after ANY change under
// ../engine so the app picks it up:
//
//   node scripts/build-engine.mjs
//
// (When ui/package.json is free to edit, alias it as "build:engine" and prefix start/web.)

import { execSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";

execSync("npx tsc -p ../engine/tsconfig.build.json", { stdio: "inherit" });
rmSync("./_engine", { recursive: true, force: true });
cpSync("../engine/dist", "./_engine", { recursive: true });
console.log("✓ engine rebuilt → ui/_engine");
