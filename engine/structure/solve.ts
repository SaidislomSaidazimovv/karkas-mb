// engine/structure/solve.ts — S3-E1 parametric solver.
//
// Turns the Construction structural model (Block → Zone → Section → Instance) into the
// flat manufacturing `Part[]` the SWJ008 path consumes. This is the bridge that was
// missing — `index.ts` notes "Later layers (Layer 2 parametric solver) plug in here";
// THIS is that layer. Before it, parts were hand-authored fixtures with no path from
// design intent to a cuttable panel set.
//
// FIRST SLICE: generates the carcass (2 sides + top + bottom), one divider panel per
// `Line`, and a shelf panel per `internal_shelf` instance — each with dimensions DERIVED
// from block/section geometry. Drilling operations are added in S3-E2 (primitive
// integration); parts here carry `operations: []` (a blank panel is still a valid,
// cuttable Part). Other panel roles (facade/back/drawer) land in later steps.
//
// CONVENTIONS (mm10; 16 mm board = 160, L1 single stock):
//   block.box / section.box = { w: width(X), h: height(Y), d: depth(Z) }
//   Part.length_mm10 = X extent, Part.width_mm10 = Y extent  (SWJ008: X=Length, Y=Width)
//   Sides stand full height × depth; top/bottom span the inner width (w − 2·board).
//
// PURE & DETERMINISTIC: same model in → same parts out. No mutation, no I/O.

import type { Grain, Part, mm10 } from "../contracts/types.js";
import {
  leafSections,
  type Block,
  type Component,
  type Instance,
  type Line,
  type Section,
  type StructuralModel,
} from "../contracts/structure.js";

/** 16 mm stock — the only board thickness (law L1). */
export const BOARD_MM10: mm10 = 160;

/**
 * Edge-band tape thickness on a banded (visible) edge — 1.0 mm. GROUNDED: factory golden files
 * show banded edges at Thickness="1.000" (e.g. POLKA-1_7_1.XML), and the field research
 * (Researches/-R7F_3_factory_answers.md, DB/-rF_4_market_reframe.md) confirms "kromka 1mm is the
 * 99% default" (visible 1.0 · hidden 0.4 · premium 2.0) — superseding the older 0.4/2.0 in
 * 06_CONVENTIONS §5. S3-E5 / L8: a banded edge must be EMITTED in the cut output, not implied.
 */
export const EDGE_BAND_MM10: mm10 = 10;

const GRAIN: Grain = "L";

function panel(
  id: string,
  name: string,
  length_mm10: mm10,
  width_mm10: mm10,
  edges: Part["edges"] = [0, 0, 0, 0],
): Part {
  return {
    id,
    name,
    length_mm10,
    width_mm10,
    thickness_mm10: BOARD_MM10,
    grain: GRAIN,
    edges,
    operations: [],
  };
}

/**
 * The FRONT edge banded at 1.0mm. Front = Face 1 = edges[0] = the Y=Width (depth-front) edge.
 * SWJ008 face map (GROUNDED from factory edge-drill coordinates: Face1 drills at Y=Width, e.g.
 * POL_3_1.XML Face1 @ Y=503=Width): Face1=top(Y-max) · Face2=bottom(Y=0) · Face3=right(X-max) ·
 * Face4=left(X=0). Every solved carcass/shelf/divider here has Width = depth, so its room-facing
 * front edge is Face 1. (POLKA-1 bands its front edge too — its Face 3 only because that panel is
 * drawn transposed, depth = X.) Fresh array per call to avoid shared references.
 */
const frontBand = (): Part["edges"] => [EDGE_BAND_MM10, 0, 0, 0];

/** All four edges banded — a facade/door is visible from every side (GROUNDED: the factory door
 *  SHKOF_ORTA_CHAP_ESHIK_7_1.XML bands Face 1/2/3/4 at 1.000mm). */
const allBand = (): Part["edges"] => [EDGE_BAND_MM10, EDGE_BAND_MM10, EDGE_BAND_MM10, EDGE_BAND_MM10];

/**
 * L1 doubling: a 32mm build = TWO glued 16mm boards, never one 32mm board. Emit two Part records
 * (same geometry, 16mm each). The doubled edge wears ONE kromka run — the OUTER layer keeps the
 * front band, the INNER layer is bare (the glue seam hides under the band). Follows L1 literally
 * ("cut list emits two boards + wider kromka run").
 * NOTE: the exact per-board SWJ008 encoding of a doubled edge's kromka run awaits a factory
 * doubled-panel export to confirm (S3-E7); this is the L1-literal representation until then.
 */
export function doublePanel(base: Part): [Part, Part] {
  const outer: Part = { ...base, id: `${base.id}__a`, name: `${base.name} · слой A`, operations: [] };
  const inner: Part = { ...base, id: `${base.id}__b`, name: `${base.name} · слой B`, edges: [0, 0, 0, 0], operations: [] };
  return [outer, inner];
}

// Glazed-grid dimensions (CONSTRUCTION_FRAME_v3 Piece 2). NOT fixture-grounded — reasonable
// defaults, confirm at the factory (S3-E7). Frame + muntins are 16/32mm wood; the pane is 3mm glass.
const GLAZED_FRAME_W: mm10 = 400; // 40 mm outer stile/rail width
const GLAZED_MUNTIN_W: mm10 = 200; // 20 mm muntin bar width
const GLASS_MM10: mm10 = 30; // 3 mm glass pane (factory OYNA panes measure 3mm)

/** A glass pane Part — 3mm, no grain, no edge-banding. */
function glassPane(id: string, name: string, length_mm10: mm10, width_mm10: mm10): Part {
  return { id, name, length_mm10, width_mm10, thickness_mm10: GLASS_MM10, grain: "NONE", edges: [0, 0, 0, 0], operations: [] };
}

/**
 * A glazed-GRID door → the full assembly: outer frame (2 stiles + 2 rails, 32mm doubled, banded)
 * + (lights−1) muntins (16mm) + `lights` glass panes (3mm), stacked along the door height (X).
 * v3 Piece 2: the outer frame is a 32mm group, the muntins a 16mm group. Dimensions use the
 * flagged glazed-grid defaults above.
 */
function glazedGridParts(idBase: string, name: string, length: mm10, width: mm10, lights: number): Part[] {
  const Fw = GLAZED_FRAME_W;
  const Mw = GLAZED_MUNTIN_W;
  const n = Math.max(1, Math.round(lights));
  const innerW = width - 2 * Fw; // opening width between the stiles
  const innerH = length - 2 * Fw; // opening height between the rails
  const parts: Part[] = [];

  // Outer frame — 32mm (two glued 16mm boards each), banded all round.
  parts.push(...doublePanel(panel(`${idBase}__stile_l`, `${name} · стойка Л`, length, Fw, allBand())));
  parts.push(...doublePanel(panel(`${idBase}__stile_r`, `${name} · стойка П`, length, Fw, allBand())));
  parts.push(...doublePanel(panel(`${idBase}__rail_b`, `${name} · рама низ`, innerW, Fw, allBand())));
  parts.push(...doublePanel(panel(`${idBase}__rail_t`, `${name} · рама верх`, innerW, Fw, allBand())));

  // Muntins — 16mm bars between the lights.
  for (let i = 0; i < n - 1; i += 1) {
    parts.push(panel(`${idBase}__muntin_${i}`, `${name} · раскладка ${i + 1}`, innerW, Mw));
  }

  // Glass panes — 3mm, one per light; the opening height splits evenly after the muntins.
  const paneH = Math.floor((innerH - (n - 1) * Mw) / n);
  for (let i = 0; i < n; i += 1) {
    parts.push(glassPane(`${idBase}__glass_${i}`, `${name} · стекло ${i + 1}`, paneH, innerW));
  }

  return parts;
}

/** Carcass box: two sides (full height × depth) + top + bottom (inner width × depth). */
/** Five carcass panels for a rectangular volume (idBase-prefixed). `omitSideR` drops the right
 *  side — used at an L-corner where one leg abuts the other (avoids a doubled wall). */
function boxCarcass(idBase: string, label: string, w: mm10, h: mm10, d: mm10, omitSideR = false): Part[] {
  const innerW = w - 2 * BOARD_MM10;
  const ps = [
    panel(`${idBase}__side_l`, `${label}Бок левый`, h, d, frontBand()),
    panel(`${idBase}__side_r`, `${label}Бок правый`, h, d, frontBand()),
    panel(`${idBase}__top`, `${label}Верх`, innerW, d, frontBand()),
    panel(`${idBase}__bottom`, `${label}Низ`, innerW, d, frontBand()),
    panel(`${idBase}__back`, `${label}Задняя стенка`, w, h), // back is hidden — not banded
  ];
  return omitSideR ? ps.filter((p) => !p.id.endsWith("__side_r")) : ps;
}

function carcassParts(block: Block): Part[] {
  const { w, h, d } = block.box;
  return boxCarcass(block.id, "", w, h, d);
}

// Corner-filler width (blocker #6) — a narrow strip that bridges the L junction. NOT fixture-
// grounded; a reasonable default, confirm at the factory (S3-E7).
const CORNER_FILLER_W: mm10 = 500; // 50 mm

/**
 * An L-corner block (blocker #1: "block can be L, not just box; the corner object owns the
 * depth-step") → the L carcass: leg-A's carcass + leg-B's carcass (its side that abuts leg-A
 * omitted — the corner join) + a corner filler (blocker #6). Each leg carries its own depth
 * (blocker #3). Dimensions only — the 3D L placement is solveLayout's job (follow-up).
 * (Judgment, flagged: which leg omits its corner side, and the filler width, are not in v3 —
 * v3 grounds the L-block + per-leg depth + "auto-emit filler"; these are the emit details.)
 */
function lCornerParts(block: Block): Part[] {
  const fp = block.footprint!;
  const h = block.box.h;
  return [
    ...boxCarcass(`${block.id}__legA`, "Плечо A · ", fp.legA.length_mm10, h, fp.legA.depth_mm10),
    ...boxCarcass(`${block.id}__legB`, "Плечо B · ", fp.legB.length_mm10, h, fp.legB.depth_mm10, true),
    panel(`${block.id}__corner_filler`, "Угловая планка", h, CORNER_FILLER_W, frontBand()),
  ];
}

/** A vertical divider (axis "x") stands between top and bottom, full depth. */
function dividerPart(block: Block, line: Line): Part {
  const { h, d } = block.box;
  return panel(`${block.id}__div_${line.id}`, "Перегородка", h - 2 * BOARD_MM10, d, frontBand());
}

function sectionById(block: Block, sectionId: string): Section | null {
  for (const zone of block.zones) {
    for (const leaf of leafSections(zone.root)) {
      if (leaf.id === sectionId) return leaf;
    }
  }
  return null;
}

function componentById(block: Block, componentId: string): Component | null {
  return block.components.find((c) => c.id === componentId) ?? null;
}

/** One placed instance → its content panel(s), sized from the section it sits in.
 *  Returns two boards when the component is `doubled` (L1), one otherwise, or none for
 *  roles not yet emitted. */
function instanceParts(block: Block, inst: Instance): Part[] {
  const section = sectionById(block, inst.sectionId);
  const component = componentById(block, inst.componentId);
  if (!section || !component) return [];
  // First slice handles shelves; other roles return [] until their step.
  if (component.role === "internal_shelf") {
    const length = section.box.w - 2 * BOARD_MM10; // span between sides / dividers (X)
    const width = section.box.d; // depth (Y)
    // Banded on the FRONT edge (Face 1 = edges[0] = the Y=Width depth-front edge) — see frontBand().
    const base = panel(`${block.id}__inst_${inst.id}`, component.name, length, width, frontBand());
    return component.doubled ? doublePanel(base) : [base];
  }
  // A facade/door covers a section's front opening: height (X, hinge axis) × width (Y), banded
  // on all four visible edges. Hinge drilling is added by the drilling pass (engine/structure).
  if (component.role === "facade") {
    const length = section.box.h; // door height (X) — hinge cups run along this axis
    const width = section.box.w; // door width (Y)
    if (component.glazedGrid) {
      return glazedGridParts(`${block.id}__inst_${inst.id}`, component.name, length, width, component.glazedGrid.lights);
    }
    const base = panel(`${block.id}__inst_${inst.id}`, component.name, length, width, allBand());
    return component.doubled ? doublePanel(base) : [base];
  }
  return [];
}

/**
 * The parametric solve: structural model → flat manufacturing `Part[]`.
 * Feed the result to `solveFull` / `solveAndExportSWJ008` (it slots in exactly where
 * hand-authored parts used to).
 */
export function solveStructure(model: StructuralModel): Part[] {
  const parts: Part[] = [];
  for (const block of model.blocks) {
    parts.push(...(block.footprint ? lCornerParts(block) : carcassParts(block)));
    for (const line of block.lines) parts.push(dividerPart(block, line));
    for (const inst of block.instances) parts.push(...instanceParts(block, inst));
  }
  return parts;
}
