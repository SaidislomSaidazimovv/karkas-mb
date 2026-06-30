# MEBELCHI — Construction Mode · Pre-Figma Frame v3

**Supersedes:** `CONSTRUCTION_FRAME_v2.md`. Fixes the three findings from red-team round 2.
**What this is:** The complete Construction frame, with the selection model corrected, the acceptance flows re-run honestly, and a blocker ledger that carries unresolved items across rounds so nothing leaks again.
**What this is NOT:** Not code, not visual design, not styling. Only Construction.

---

## 0 · What red-team 2 broke, and what v3 changes

Red-team 2 found three things. v3 fixes all three.

| Finding | What was wrong | v3 fix |
|---|---|---|
| **META-C: group-first is global** | v2 imposed group-first on every piece. Right for uniform kitchens, backwards for irregular wardrobes. Group-of-1 carried the same ceremony + detach tax as group-of-8. | **Adaptive group model (§1).** Group behavior scales with member count. Group-of-1 behaves as a direct instance — no ceremony, no detach, no counter. Group-first engages only at ≥2 members. |
| **META-A: flows graded on easiest reading** | All three fixtures "passed" by charitable interpretation — uniform members, no glass rebate, isolated laminations, asserted junctions. "Expressible" was confused with "buildable." | **Hardest-reading acceptance (§7).** Every flow now specifies mixed-not-uniform members, names the manufacturing detail that must be *emitted* (not just shown), and separates "expressible" from "buildable." |
| **META-B: findings leak between rounds** | L-corner, Merge, and the iPhone-box junction were flagged in round 1, vanished in v2. | **Blocker ledger (§9).** A running list of every unresolved item across all rounds, with status. Nothing drops without being explicitly closed. |

---

## 1 · The selection model — ADAPTIVE (the big fix)

This replaces v2's L0. It is the load-bearing change of v3.

### The core rule
**Group behavior scales with how many members a type has.** The same tap does different things depending on whether the thing you touched has siblings.

| Type has… | Tap selects | Edit scope | Detach | Counter |
|---|---|---|---|---|
| **1 member** (unique part) | that part directly | just it (there's nothing else) | N/A — nothing to detach from | not counted |
| **2+ members** (real group) | the whole type; siblings highlight | all members, one action | available (buried) → `✂` | counted |

**The principle:** group-first is a *behavior that emerges when siblings exist*, not a mode imposed when they don't. A group of one is just a part. You never pay group ceremony for a part that has no group.

> **Confident call:** group-of-1 must behave as a direct instance. This is unambiguous — there is nothing to "detach from" when a part is unique, so the detach path and the exceptions counter simply don't apply. The wardrobe's irregular shelves stop paying tax.
>
> **Judgment that deserves your gut-check:** the threshold for "real group" is ≥2 identical members. But there's a subtler question — *intent*. If a master places 5 shelves meaning them to stay identical, ≥2 is right (edit all five at once). But if he places 5 shelves meaning each to become different, even ≥2 is friction. The threshold can't read intent. **My call: ≥2 by geometry is the rule, but the first edit to a fresh group offers a one-time choice — "keep these linked" or "these will each differ" — and remembers it.** If "each differs" is chosen, the group silently dissolves into independent parts (each a group-of-1), and no detach tax ever applies. Flag this for your reaction — it's the part most likely to need tuning.

### What this does to the wardrobe
Walk the irregular wardrobe through v3:
- Dress-zone shelf → unique → group-of-1 → tap selects it directly, size it, done. **No detach, no counter.**
- Merged-zone shelf → unique → group-of-1 → same. **No tax.**
- Footwear shelves, 3 identical → group-of-3 → tap selects all three, size all at once (they share a depth). **Group-first pays off here.**
- If the two legs' footwear shelves differ in depth → two groups of fewer members, or chosen "each differs" at placement → independent. **No false alarms.**

The exceptions counter now reflects *genuine* one-offs (a part deliberately broken out of a real group), not the natural irregularity of the piece. For the wardrobe, the counter stays near 0 — correctly — because irregular-by-design is not the same as exception-from-a-group.

### What this does to the kitchen
Unchanged from v2's intent. A kitchen with 8 identical base cabinets → group-of-8 → edit all at once. Group-first shines exactly where v2 wanted it. The fix doesn't weaken the uniform case; it stops punishing the irregular one.

### The selection card reflects the mode it's in
```
GROUP-OF-1 (unique part)              GROUP-OF-N (real group)
┌──────────────────────────┐         ┌──────────────────────────┐
│ [icon] Полка-платье       │         │ [icon] Полка-обувь        │
│ Уникальная деталь         │         │ Тип · 3 детали выделено   │
│ (no exceptions concept)   │         │ [связаны] · ✂ при отделении│
└──────────────────────────┘         └──────────────────────────┘
```

The card *tells you which world you're in*: "Уникальная деталь" (unique part — edit freely) vs "Тип · 3 детали" (type with 3 members — edits travel). The master always knows whether his edit spreads.

---

## 2 · The locked laws (v3)

**L0 — Adaptive group editing.** (Replaces v2's L0.) Tap selects the whole type *if it has 2+ members* (siblings highlight, edit travels); tap selects the part directly *if it's unique* (no ceremony). Detach + exceptions counter apply only to real groups (2+). Material roles propagate globally by design. First edit of a fresh multi-member group offers "keep linked / each differs," remembered.

**L1 — 16mm stock only.** No 32mm board. 32mm = two glued 16mm boards. Doubled edge wears one 32mm kromka; seam hidden under band. Cut list emits two boards + wider kromka run.

**L2 — WYSIWYG, all structural.** No decorative concept. Shown = cut. Lightness via real partial doubling.

**L3 — Offset/recess capable but demoted.** Off-plane (reveals, stepped junctions, overlap) achievable but advanced/long-press only. Never the main toolbar.

**L4 — Rectangle outlines for V1.** Lamination + depth-planes ship. Non-rectangular outlines deferred; reserve, don't build.

**L5 — Stability risk surfaced, non-blocking.** Declare any cabinet/panel load-bearing → stability check → ⚠ flag. Warns, never blocks.

**L6 — Height is not a drag axis.** Thickness is material (16mm). Resize is 2-axis.

**L7 — Mode sets verbs, View sets visibility.** One mode, stackable lenses.

**L8 — NEW: Manufacturing detail must be emitted, not implied.** (From red-team 2 META-A.) A feature shown in 3D is not done until its machining is emitted: glass needs its rebate groove, a doubled edge needs its kromka run, a junction needs its actual offset values. The frame distinguishes "shown" from "cut." Acceptance tests check the cut output, not the render.

---

## 3 · The six zones (deltas from v2 only)

The six-zone structure (Top bar / Mode+View rail / Selection card / Canvas / Layers / Bottom toolbar) is unchanged from v2. Only these behaviors change:

**Zone 3 · Selection card** — now has two resting states (§1): "Уникальная деталь" for group-of-1, "Тип · N деталей" for groups. The detach control and exceptions counter appear *only* in the group state. The one-time "keep linked / each differs" choice appears on first edit of a fresh group.

**Zone 4 · Canvas** — tap resolves to part-direct (unique) or type (group) per §1. Blast-radius highlight only fires for real groups.

**Zone 5 · Layers** — the exceptions counter now counts only genuine detachments from real groups, not unique parts. A unique part shows no badge (it's neither 🔗 nor ✂ — it's just itself). New badge state: plain (unique part, no group).

**Zone 6 · Bottom toolbar** — the Select slot's "single" option is gone as a separate concept *for unique parts* (they're already single); it remains only as the detach action *inside real groups*. Everything else (doubled build, glazed-grid door, demoted offset) unchanged from v2.

Everything else in Zones 1–6 carries forward from v2 verbatim.

---

## 4 · The badge vocabulary (v3 — updated)

| Badge | Means | Edit behavior |
|---|---|---|
| (plain, no badge) | **unique part (group-of-1)** | edit directly, no ceremony — NEW |
| ◇ | rule-driven slot (ratio) | edit the rule, all reflow |
| 🔗 | linked instance in a real group (2+) | edits propagate to all |
| ✂ | detached from a real group | edits local; counted |
| ⧉ | composite/doubled build (2+ layers) | shows layer count |
| ⚠ | stability risk flagged | warning, non-blocking |
| ● | material-role color dot | per part |

The key addition: **plain = unique**. Most parts in an irregular wardrobe are plain. 🔗/✂ appear only where a genuine group exists. The tree stops screaming "exception" at every irregular shelf.

---

## 5 · The four tasks — carried from v2, unaffected by the selection fix

T1 (composite panels), T2 (recess/offset), T3 (face-types/glazed-grid), T4 (load-bearing declaration) are unchanged in *where they live and what they do*. The selection-model fix doesn't touch them. They're re-tested under the hardest reading in §7.

---

## 6 · The component inventory (v3 additions)

On top of v2's inventory, v3 adds:

| # | Surface | Lives in | Purpose |
|---|---|---|---|
| 35 | **Unique-part card state** | Zone 3 | "Уникальная деталь" resting state, no detach/counter |
| 36 | **"Keep linked / each differs" choice** | Zone 3, first group edit | one-time, remembered; dissolves group if "each differs" |
| 37 | **Plain (no-badge) tree row** | Zone 5 | unique part, visually distinct from 🔗/✂ |
| 38 | **Glass rebate indicator** | Zone 3 Frame body | shows the groove that holds glass is emitted (L8) |
| 39 | **Corner band-transition control** | Zone 3 Frame body | how 32mm and 16mm bands meet at a corner (L8) |
| 40 | **Junction value editor** | Zone 6 offset (advanced) | the actual offset/gap values for a stepped reveal (L8) |

The last three (38–40) exist because red-team 2 found these details *asserted but not emitted*. They're now real surfaces that show the machining is actually produced.

---

## 7 · Acceptance flows — RE-RUN against the hardest reading

This is the honest re-test. Each piece now specifies the *hard* interpretation, names the manufacturing detail that must be emitted, and separates "expressible" from "buildable."

### Piece 1 — L-wardrobe (the piece that drove the fix)

**Hardest reading:** irregular sections, most shelves unique, two legs of different depth, footwear shelves possibly differing between legs, a merged dress zone, a sliding accessory. The selection model must not tax the irregularity.

**Status of structural prerequisites (from the ledger, §9):**
- 🔴 **L-corner footprint** — STILL NOT BUILT. Blocker #1. The wardrobe cannot exist without it.
- 🔴 **Merge operation** — STILL NOT BUILT. Blocker #2. The dress zone cannot exist without it.
- 🟡 **Angled footwear shelves** — DEFERRED per L4. Built flat in V1; angle is V1.5.

**Build flow (assuming blockers #1, #2 resolved, which they are NOT yet):**
1. Place L-block, set leg-A depth 600, leg-B depth 400 (at block/leg level, not panel). *(per-leg depth — see ledger #3)*
2. Divide leg-A vertically by direct-split (not ratio) — direct placement for irregular. *(direct-split is the default per red-team 1 fix)*
3. Lower zone: place footwear shelves. If 3 identical → group-of-3, size all at once. **Group-first pays off — one action.**
4. Upper zones: Merge two zones → one tall dress zone. *(needs Blocker #2)*
5. Place the dress-zone shelf — **unique → group-of-1 → tap, size directly. NO detach, NO counter.** ← *the v3 fix working*
6. Place sliding pants accessory (component with motion envelope).

**Friction profile under v3:** the irregular shelves are now group-of-1 — edited directly, no tax. The 3 identical footwear shelves are a real group — edited together. The exceptions counter stays at 0 because nothing was detached from a real group; the irregularity is native, not exceptional. **This is the fix: the wardrobe no longer pays for being irregular.**

**Expressible? Yes (selection model now fits). Buildable? NO — blocked by #1 (L-corner) and #2 (Merge), which are still not built.** This is the honest separation red-team 2 demanded: the *interaction* now fits the piece, but two *structural prerequisites* remain open. v3 does not claim this piece passes — it claims the selection model is fixed and names exactly what still blocks the build.

### Piece 2 — Glazed display front (hardest reading)

**Hardest reading:** NOT uniform members. Outer frame 32mm (chunky), inner muntins 16mm (delicate) — the common real look. Glass must have a real rebate. The off-plane offset must coexist with working hinges.

**Build flow under the hard reading:**
1. Place cabinet, front all bays with solid doors (group — one action).
2. One bay → glazed-grid door. Divide inside the door into 3 lights (direct-split or equal-N).
3. **Members are NOT one type.** Outer stiles+rails = one group (32mm). Inner muntins = a different group (16mm). Select outer group → doubled build (32mm). Select muntins → leave 16mm. ← *v3 handles this because groups are by-identity; outer and inner are different types, edited separately. v2's "select all members" was wrong; v3 is right.*
4. **L8 check — glass rebate:** setting infill to glass must emit a rebate groove on the inner edge of each member. Zone 3 Frame body shows the **glass rebate indicator** (#38). If the groove isn't emitted, the piece is shown-but-not-cut and fails L8.
5. **L8 check — corner band transition:** where the 32mm outer band meets... itself (outer frame is all 32mm, so corners are 32-to-32 — consistent). The 16mm muntins meet the 32mm frame at T-junctions, not corners — the muntin's 16mm edge butts the frame's inner face. The **corner band-transition control** (#39) specifies this. Emitted, not assumed.
6. Off-plane offset (advanced/long-press) pushes the glazed door proud. **L8 + hinge check:** the offset changes hinge cup-to-plate geometry. v3 requires the hinge selection to *revalidate* against the offset — if a standard hinge can't reach, flag it (a fit-check, like stability). v2 ignored this; v3 catches it.

**Expressible? Yes. Buildable? Yes, IF — glass rebate emitted (#38), band transition specified (#39), hinge revalidated against offset.** Under the hard reading, the piece passes *only with* these three details actually produced. v3 names them as required surfaces. **This is no longer a charitable pass — it's a pass conditional on emitted machining, with the conditions named.**

### Piece 3 — Cantilever desk (hardest reading)

**Hardest reading:** the partial-doubling step interacts with what mounts under it; the per-edge kromka corners need a rule; the iPhone-box junction is multi-value, not one action.

**Build flow under the hard reading:**
1. Place pedestal, declare load-bearing.
2. Top = 16mm board. Add partial doubling: front 100mm strip, full length → 32mm front, 16mm behind, with a **16mm step on the underside 100mm back**.
3. **Hard interaction (red-team 2 Fail #7):** the pedestal and blade meet the underside. The step means the underside is 32mm at front, 16mm behind. v3 requires the pedestal/blade height to resolve against the *actual* underside plane they touch (the 16mm region behind the step), with the front oversail at 32mm. The frame must compute this, not treat the top as isolated. *(Ledger #7 — flagged, needs the model to handle step-aware mounting.)*
4. **Per-edge kromka corners (red-team 2 Fail #8):** front 32mm band runs full length; side 16mm bands meet it at the front corners. The **corner band-transition control** (#39) specifies butt/mitre/overlap. Emitted, not assumed.
5. Vertical blade → full doubling (32mm), declare load-bearing, join to top in Γ.
6. **The iPhone-box junction (red-team 2 Fail #9, red-team 1's flagged unknown):** this is NOT one action. v3 makes it the **junction value editor** (#40) with three explicit values: (a) top oversail over pedestal outer face = X, (b) pedestal face step-back = Y, (c) shadow-gap depth = Z. The advanced offset control opens this editor. The master sets X, Y, Z. *This is the specific fix for the thing asserted-not-specified in v2.*
7. Stability check fires ⚠ on the cantilever (automatic, non-blocking).

**Expressible? Yes. Buildable? Yes, IF — step-aware mounting resolved (ledger #7), corner band transition specified (#39), junction expressed as 3 values not 1 action (#40).** The signature junction is now a real multi-value editor, not a hand-wave. **This is the honest pass: the hardest detail is specified, not asserted.**

---

## 8 · What the re-run proves

| Piece | v2 claimed | v3 honest verdict |
|---|---|---|
| L-wardrobe | (admitted might fail) | **Interaction now fits** (group-of-1 no longer taxed). **Still blocked** by L-corner (#1) + Merge (#2) — named, not hidden. |
| Glazed front | clean PASS | **Conditional pass** — needs glass rebate (#38), band transition (#39), hinge-offset revalidation. Conditions named. |
| Cantilever desk | clean PASS | **Conditional pass** — needs step-aware mounting (#7), band transition (#39), junction as 3 values (#40). Conditions named. |

The difference from v2: **no piece is claimed as a clean pass.** Each verdict separates "the interaction fits" from "here's exactly what must be emitted or built for it to actually cut." That separation is the META-A fix.

---

## 9 · THE BLOCKER LEDGER (the META-B fix)

Every unresolved item across all rounds, with status. **Nothing drops off this list without being explicitly closed.** This is the artifact that stops findings from leaking between rounds.

| # | Item | Found in | Status | Notes |
|---|---|---|---|---|
| 1 | **L-corner footprint** (block can be L, not just box; corner object owns the depth-step) | Red-team 1 | 🔴 OPEN | Blocks any L-wardrobe and L-kitchen. Never built. Highest priority. |
| 2 | **Merge operation** (inverse of Divide; join 2+ zones into one) | Red-team 1 | 🔴 OPEN | Blocks the dress zone and any "remove shelf, make hanging space." Never built. |
| 3 | **Per-leg / per-block depth** (depth edited at structure level, not panel) | Red-team 1 | 🟡 PARTIAL | Stated in frame; needs confirming the reflow works. |
| 4 | **Non-rectangular outlines** (angled footwear, sloped-ceiling trapezoids) | Red-team 1 | ⏸ DEFERRED | L4 — V1.5+. Reserved, intentionally not built. |
| 5 | **Worktop as cross-block object** | Red-team 1 kitchens | ⏸ BACKLOG | Out of scope this round; logged so it isn't "discovered" late. |
| 6 | **Filler panels at corners** | Red-team 1 kitchens | ⏸ BACKLOG | Same. Corner object must auto-emit fillers when built. |
| 7 | **Step-aware mounting** (a part meeting a partially-doubled underside resolves to the real plane it touches) | Red-team 2 | 🔴 OPEN | Surfaced by the cantilever top's 100mm strip. The doubled panel can't be treated as isolated. |
| 8 | **Per-face material roles** (island with no single "back") | Red-team 1 kitchens | ⏸ BACKLOG | Roles assignable per face, not one-back-per-cabinet. |
| 9 | **Span-needs-support validation** (overhang flags for bracket) | Red-team 1 kitchens | 🟡 PARTIAL | Same machinery as stability check (L5); needs the span rule wired. |
| 10 | **Glass rebate emission** (groove that holds the pane is cut) | Red-team 2 | 🟢 ADDRESSED in v3 | Surface #38. Must verify it actually emits in the engine. |
| 11 | **Corner band-transition** (how 32mm and 16mm kromka meet) | Red-team 2 | 🟢 ADDRESSED in v3 | Surface #39. Cosmetic + cut-list precision. |
| 12 | **Junction value editor** (stepped reveal = 3 values, not 1 action) | Red-team 1 + 2 | 🟢 ADDRESSED in v3 | Surface #40. The twice-flagged junction, now specified. |
| 13 | **Offset ↔ hinge interaction** (off-plane door revalidates hinge reach) | Red-team 2 | 🟢 ADDRESSED in v3 | Fit-check on the offset. Must verify the revalidation fires. |
| 14 | **Group intent at placement** ("keep linked / each differs") | Red-team 2 (this round) | 🟡 NEW / NEEDS YOUR CALL | §1 judgment. The threshold rule most likely to need tuning. |
| 15 | **Undo/redo journaled** | Red-team 1 | 🟡 CARRIED | In the laws; must be designed into every op, not bolted on. |

**Legend:** 🔴 open blocker · 🟡 partial/needs confirmation · 🟢 addressed in v3 (verify in build) · ⏸ deferred/backlog (intentional).

**The three that still block real pieces right now: #1 (L-corner), #2 (Merge), #7 (step-aware mounting).** These are the next build targets. Everything 🟢 is addressed in this frame but must be verified when the engine emits real files. Everything ⏸ is a conscious deferral, logged so it doesn't reappear as a surprise.

---

## 10 · What to verify before Figma

1. **The adaptive selection model (§1)** — confirm group-of-1-behaves-as-instance is right (I'm confident) and react to the "keep linked / each differs" one-time choice (ledger #14 — the part most likely to need tuning).

2. **The three open blockers (#1, #2, #7)** — these aren't Figma problems, they're model problems, and they block your signature wardrobe. Decide whether they're built before Figma or whether Figma proceeds on the parts that *are* unblocked (kitchens, simple wardrobes, the two display/desk pieces under their named conditions).

3. **The 🟢-addressed surfaces (#38–40, #13)** — these are drawn in the frame but must actually emit machining when the engine is real. Flag them for the build phase as "verify emitted, not just shown."

The selection model is fixed. The flows are honest. The ledger holds the line. The remaining real work is three model blockers — and those are build decisions, not frame decisions.
