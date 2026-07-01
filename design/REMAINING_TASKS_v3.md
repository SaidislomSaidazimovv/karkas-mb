# Каркас (Construction Mode) — Remaining Tasks · scoped to CONSTRUCTION_FRAME_v3.md

**Scope:** ONLY what `CONSTRUCTION_FRAME_v3.md` defines (the Каркас frame). The broader Mebelchi
engine (pricing, sheet-nesting, joint-mining doc 16, full material catalog doc 17, full physics,
multi-project, drawer/rail systems, component library) is the FULL product — **out of this scope**.
Design system (colours/fonts) is borrowed from Part-1 (`netlifypictures/`); function is independent.

**Order of work (founder, 2026-07-01): ENGINE 100% first, THEN UI.** P does engine solo; T1/T2 wait.

> Last synced to code: **2026-07-01, HEAD `b52c6c1`**, 149 engine tests. This list is the output of a
> full v3-vs-code audit. Item codes (E#/U#) match that audit. Do NOT invent work beyond v3.

---

## ✅ ALREADY DONE (engine — `b1562fd`…`b52c6c1`)
- `solveStructure` (carcass 2 sides+top+bottom+back · divider-per-Line · internal_shelf) · `solveLayout`
  · `solveModelToParts` (cnc.ts, Metro-isolated)
- store-wiring live: divideSection · **mergeSections** · moveLine · selectByTap · detach/reattach ·
  addInstance(shelf) · undo/redo · view lenses · layers tree + eye-hide · price ticker · camera orbit
- **doublePanel** / **partialDoublePanels** (2×16mm + 32mm kromka run)
- **single door/facade** + facade layout + **hinge cups Ø35** + **single-door glass rebate #38**
- **glazed pane** + **glazed-grid structure** (`glazedGridParts`)
- **L-corner**: content / layout / divider / drilling + 500mm blind-corner filler
- **step-aware #7 (DONE)**: `undersidePlaneAt` + `Component.mount` (pedestal height → real underside plane)
- drilling: shelf-pins Ø5×11 @91.5mm (factory-grounded) · edge-banding (front Face1 @1.0mm, back bare)
- `validateParts` (bounds only) · `exportSWJ008` (byte-exact) · hiddenIds
- tests for all of the above (`tests/structure_*.test.ts`)

---

## ✅ ENGINE — ALL 14 DONE (2026-07-01, HEAD `811d39c`, 206 tests)

E1 SWJ008 export `60842e7` · E8 resize `5ac1873` · E7 stability `4a5b534` · E2 glazed-grid layout
`8911d30` · E3 grid rebate `8fd266c` · E4 #39 band-transition `fcf6374` · E5 #40 junction `e44a27d`
· E6 #13 hinge revalidation `08ead26` · E12 emit-completeness gate `85c4bdc` · E9 motion envelope
`95fec28` · E10 group-dissolve `78789e7` · E11 addInstance door/divider+doubled `9b6fb50` · E13
drilling refine `021a7aa` · E14 L-corner refine `811d39c`. All v3-grounded (deep-research; SWJ008-
inexpressible / V2 / factory-datasheet items honestly flagged, not guessed). **Next phase: UI (below).**

<details><summary>original engine breakdown (now all ✅)</summary>

## 🔧 ENGINE — done (v3 scope) · 14 items · priority-ordered

| # | Item | v3 grounding | State | What's left | Size |
|---|------|-------------|-------|-------------|------|
| **E1** | **SWJ008 emit from live model** | L8, §10.3 · the app's purpose | ⚠ unreachable | `cnc.ts:solveModelToParts` exists but not re-exported by `index.ts`, not in `engineBridge`, no store action. Wire solve→drill→validate→exportSWJ008 reachable by UI. | M |
| **E8** | Structure-level depth/resize op | Piece 1 step 1 (blocker #3) | Partial | `LegSpec` static; no op edits depth/leg-depth (store `resize` stub). Reflow-on-depth unproven. | M |
| **E7** | #9 stability / load-bearing ⚠ | L5, ledger #9, Piece 3 step 7 | Missing | No load-bearing flag on Block/Section; no span/overhang rule. NON-BLOCKING ⚠ only (not physics). | M |
| **E2** | Glazed-grid 3D layout | Piece 2 | Missing | `layout.ts facadePlacement` returns `null` for `glazedGrid` → renders nothing. Emit stile/rail/muntin/pane positions. | M |
| **E3** | Per-member glazed-grid rebate | Piece 2 step 4, L8 #38 | Missing | `glassRebate` fires only for single-pane `glazed`; grid members/muntins get no groove. | M |
| **E4** | #39 corner band-transition | §6 #39, L8, Piece 2/3 | Missing | No butt/mitre/overlap model; `edges` is per-face thickness only. Per-edge-segment banding + transition kind. | M |
| **E5** | #40 junction value editor (model) | §6 #40, Piece 3 step 6 | Missing | No `Offset3D`/junction field on Section/Instance (X oversail / Y step-back / Z shadow-gap). | M |
| **E6** | #13 hinge revalidation vs offset | Piece 2 step 6, ledger #13 | Missing | Depends on E5. No offset → no hinge-reach check → no ⚠. | M |
| **E12** | validate L8 emit-completeness gate | L8, §10.3 | Missing | `validate.ts` never checks a glazed door emitted its rebate, a doubled edge its kromka, a junction its values. | M |
| **E9** | Sliding motion-envelope component | Piece 1 step 6 (the ONLY moving part in v3) | Missing | No `motion`/envelope field; no solver/layout; slide-drilling absent. `addInstance` drawer/rail no-op. | M |
| **E10** | "Each differs" group dissolution | §1, ledger #14, surface #36 | Missing | No op to dissolve a fresh multi-member group into independent group-of-1s (UI overlay has no backing). | S–M |
| **E11** | addInstance divider/door + doubled flag | door=facade (Piece 2), divider structural | Partial | `operations.ts:643` supports only `"shelf"`; divider/door no-op; no way to pass `doubled`. | S each |
| **E13** | Drilling refinements | L8, factory golden | Partial | (a) shelf-pins Face A only — factory both faces; (b) both doubled door layers get cups (outer only); (c) grid outer stile gets no hinge; (d) hinge spacing ±1mm needs more exports; (e) rebate dims `verified:false`. | S–M |
| **E14** | L-corner refinements | blocker #1/#6, Researches -h03 | Partial | corner back-panel exclusion + which leg omits its corner side flagged "later"; only leg-A carries content. | S |

**ENGINE — NOT v3-grounded (do NOT build as Каркас scope):** full drawer/rail hardware system,
штанга/hanging rod machining, handle/knob drilling — none appear in v3 (searched: no
"drawer/ящик/штанга/rail/rod/handle/knob"). The only motion item in scope is **E9**.

---

</details>

## 🎨 UI — remaining (v3 scope) · AFTER engine · for T1/T2 later — **← NOW THE ACTIVE PHASE**

**Wired & working (not remaining):** adaptive selection card · divide · detach · undo/redo · layers
tree + eye-hide · price ticker · camera orbit · view lenses (geometry/lines/glass/dimension) ·
AddSheet nav · MenuSheet · ExportSheet cut-list preview.

| # | Control / panel | Should do | State | Pairs with |
|---|-----------------|-----------|-------|-----------|
| **U1** | CNC export button | Emit real SWJ008 (L8) | Stub (`ExportSheet.tsx:56`) | E1 |
| **U2** | Resize ⤢ + Ширина/Глубина steppers | 2-axis + per-leg depth (L6, Piece 1) | Stub (`appStore.ts:267`) | E8 |
| **U3** | **Merge button** | Join zones (blocker #2) | **Missing — engine DONE, cheapest win** | — |
| **U4** | L-corner shape selector | Create L block (blocker #1) | Missing (always boots rectangular) | E14 |
| **U5** | Material panel body | Per-role material, global propagate (L0) | Stub (local only, `SelectionSheet.tsx:176`) | +engine material field |
| **U6** | Hardware panel body | Hinge selection (Piece 2) | Stub (local `pick`) | E13 |
| **U7** | Frame-mode body | Host #38/#39/#40 | Stub (one local toggle) | E4/E5 |
| **U8** | #38 glass-rebate indicator | Show groove emitted (§6 #38) | Missing | E3 |
| **U9** | #39 corner-band control | butt/mitre/overlap (§6 #39) | Missing (static badge) | E4 |
| **U10** | #40 junction X/Y/Z editor | 3 values (§6 #40) | Missing | E5 |
| **U11** | #13 hinge-revalidation surface | ⚠ if hinge can't reach (Piece 2) | Missing | E6 |
| **U12** | Glazed-grid door create + render | Piece 2 | Missing | E2 |
| **U13** | Stability ⚠ + load-bearing declaration | L5, Piece 3 | Stub/Missing (static badge) | E7 |
| **U14** | Move ↕ + scope (Локально·Линия·Ряд·Все) | moveLine w/ scope (DB19 §3.4) | Missing/Stub (`moveLine` unwired) | — |
| **U15** | "Keep linked / each differs" | §1, #36, #14 | Half-wired (local `chosen` only) | E10 |
| **U16** | AddSheet divider/door leaves | door/divider grounded | Stub (call engine no-op) | E11 |
| **U17** | Layers per-row lock toggle | Zone 5 layers lock | Missing (`lock` glyph unused) | — |
| **U18** | Rotate ↻ handle | — | Stub · weak grounding · low | — |
| **U19** | View-cube | — | Missing · not in v3 · low | — |
| **U20** | TopBar breadcrumb + back | project context | Stub (hardcoded) · cosmetic · OUT | — |
| **U21** | Native (device) 3D canvas | 3D on iOS/Android | Stub (web-only) · infra · OUT | — |

---

## 🎯 PRIORITIZED ORDER (grounded-first)

**P0 — strongest grounding (explicit v3 blockers + L8 emitted-machining + core editing):**
1. **E1 + U1** — SWJ008 export end-to-end (the product's reason to exist)
2. **E8 + U2** — structure-level depth/resize op (blocker #3; resize stub blocks basic editing)
3. **U3** — Merge button (engine done, UI missing — cheapest high-value win)
4. **E7 + U13** — stability / load-bearing declaration + ⚠
5. **E2 + E3 + U12** — glazed-grid layout, per-member rebate, create+render

**P1 — #39/#40/#13 surfaces + role wiring:**
6. E4 + U9 (#39 corner band) · 7. E5 + U10 (#40 junction) · 8. E6 + U11 (#13 hinge) ·
9. E12 (validate gate) · 10. U5 +material field (Material wiring) · 11. U6 (Hardware hinge)

**P2 — v3-grounded edges:**
12. E9 + U16 (motion component) · 13. E10 + U15 (group dissolution) · 14. E11 + U16 (addInstance) ·
15. U14 (moveLine UI + scope) · 16. E13 (drilling refinements) · 17. E14 + U4 (L-corner UI) ·
18. U17 (layers lock)

**P3 — weak/no v3 grounding (defer or confirm OUT):** U18 rotate · U19 view-cube · U20 breadcrumb ·
U21 native 3D; explicitly OUT: full drawer/rail, штанга rod, handle/knob drilling, save/load.

---

## ⛔ OUT OF SCOPE (broader Mebelchi / full product — NOT the Каркас frame)
Live pricing engine · sheet-nesting (CutLayout) · joint-mining pipeline (doc 16) · full material
catalog ЛДСП/МДФ (doc 17) · full physics engine · multi-project · component library · drawer/rail
systems · штанга rod · handle/knob drilling · manufacturing-gate rules · save/load.

## ⏸ v3 DEFERRED (ledger — intentional, logged so they don't resurface)
#4 non-rectangular outlines (angled shelves, V1.5) · #5 worktop cross-block · #6 corner filler
panels · #8 per-face material roles.
