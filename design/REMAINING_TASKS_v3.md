# Каркас (Construction Mode) — Remaining Tasks · scoped to CONSTRUCTION_FRAME_v3.md

**Scope:** ONLY what `CONSTRUCTION_FRAME_v3.md` defines (the Каркас frame). The broader Mebelchi
engine (pricing, sheet-nesting, joint-mining doc 16, full material catalog doc 17, full physics,
multi-project, drawer/rail systems, component library) is the FULL product — **out of this scope**.
Design system (colours/fonts) is borrowed from Part-1 (`netlifypictures/`); function is independent.

**Order of work (founder, 2026-07-01): ENGINE 100% first, THEN UI.** P does engine solo; T1/T2 wait.

---

## ✅ ALREADY DONE (engine)
solveStructure (carcass 2 sides+top+bottom+back · divider-per-Line · internal_shelf) · store-wiring
live · divideSection/moveLine/selectByTap/detach/reattach/addInstance(shelf) · undo/redo · drilling
(shelf-pin, factory-grounded Ø5/11mm/91.5mm) · edge-banding (front Face1 @1.0mm, back bare) ·
validateParts(bounds) · exportSWJ008(byte-exact) · hiddenIds.

---

## 🔧 ENGINE — remaining (v3 scope), in build order

### 1. #2 Merge operation 🔴 (ledger #2) — `engine/structure/operations.ts`
`mergeSections(model, sectionIds[])` — inverse of divideSection: join 2+ adjacent children of a
parent, remove the divider Line(s) between them, preserve instances. Effort M. Unblocks dress-zone.

### 2. Doubling (L1 / T1 composite) — `engine/structure/solve.ts`, `contracts/structure.ts`
A doubled panel = 2 glued 16mm boards (never one 32mm). Emit TWO Part records + one 32mm kromka
run. Marker on role/instance. Foundational for glazed 32mm frame, cantilever, step-aware. Effort M.

### 3. Door/facade role + hinge drilling — `solve.ts`, `drilling.ts`
Emit facade/door panels (4-edge banding); wire `hingeCupPattern` (ready, verified) at hinge
positions. Enables Piece 2 (glazed front). Effort M.

### 4. Glazed-grid door (T3) + #38 glass rebate 🟢 — `solve.ts`, `drilling.ts`, primitives
Divide a door into lights; outer stiles/rails (32mm group) vs inner muntins (16mm group). Glass
infill → emit a **rebate groove** (SawGroove) on inner edges (L8 #38). Effort L.

### 5. #39 corner band-transition 🟢 — `solve.ts` + cut-list
Where 32mm and 16mm bands meet at a corner/T-junction: butt / mitre / overlap. Per-edge-segment
banding. Effort M.

### 6. #40 junction value editor 🟢 + #13 hinge revalidation 🟢 — `operations.ts`, `structure.ts`
Stepped reveal = 3 explicit values (X top-oversail / Y step-back / Z shadow-gap), an Offset3D on
Section/Instance. #13: off-plane offset revalidates hinge reach → ⚠ if it can't reach. Effort M.

### 7. #1 L-corner footprint 🔴 (ledger #1 — highest priority) — `structure.ts`, `solve.ts`, `layout.ts`, `operations.ts`
Block can be L-shaped (corner object owns the depth-step), not just a rectangular Box3D. Ripples
through solve/layout/all reflow. Unblocks L-wardrobe/L-kitchen. Effort L. Do with a stable base.

### 8. #3 per-leg / per-block depth 🟡 (ledger #3) — `structure.ts`, `operations.ts`
Two legs of an L can have different depths; depth edited at structure level. Depends on #1. Effort M.

### 9. #7 step-aware mounting 🔴 (ledger #7) — `solve.ts`, `layout.ts`
A part meeting a partially-doubled underside resolves to the REAL plane it touches (16mm region
behind the step), front oversail 32mm. Depends on doubling (task 2). Effort L.

### 10. #9 stability flag 🟡 (L5 / ledger #9) — `validate.ts`
Declare load-bearing → simple span/overhang check → ⚠ flag. **NON-BLOCKING warn** (NOT a full
physics engine). Effort M.

### 11. #15 undo journaled 🟡 (ledger #15)
Already in the store (past/future). Confirm every op is journal-friendly (pure). Effort S.

### Supporting (small): addInstance(divider/door) wiring · Selection.sectionId · PanelRole enum
expand · error taxonomy · integration tests (merge / door-hinge / glazed / L-corner).

---

## 🎨 UI — remaining (v3 scope), AFTER engine — for T1/T2 later
- Material / Hardware / Frame mode bodies → store actions (wire to engine roles)
- Canvas handles ↻ rotate / ↕ move / ⤢ resize → engine ops
- CNC export button → real SWJ008 file
- Blocker UIs: #1 L-corner shape select · #2 Merge button · #7 step-aware warning badge
- L8 surfaces: #38 glass rebate toggle · #39 corner-band 3-choice · #40 junction X/Y/Z editor
- Layers per-row lock toggle · view-cube · SVG icon set (replace glyphs)

---

## ⛔ OUT OF SCOPE (broader Mebelchi / full product — NOT the Каркас frame)
Live pricing engine · sheet-nesting (CutLayout) · joint-mining pipeline (doc 16) · full material
catalog ЛДСП/МДФ (doc 17) · full physics engine · multi-project · component library · drawer/rail
systems · manufacturing-gate rules.

## ⏸ v3 DEFERRED (ledger — intentional, logged so they don't resurface)
#4 non-rectangular outlines (angled shelves, V1.5) · #5 worktop cross-block · #6 corner filler
panels · #8 per-face material roles.
