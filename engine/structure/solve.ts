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

/** Carcass box: two sides (full height × depth) + top + bottom (inner width × depth). */
function carcassParts(block: Block): Part[] {
  const { w, h, d } = block.box;
  const innerW = w - 2 * BOARD_MM10;
  return [
    panel(`${block.id}__side_l`, "Бок левый", h, d, frontBand()),
    panel(`${block.id}__side_r`, "Бок правый", h, d, frontBand()),
    panel(`${block.id}__top`, "Верх", innerW, d, frontBand()),
    panel(`${block.id}__bottom`, "Низ", innerW, d, frontBand()),
    panel(`${block.id}__back`, "Задняя стенка", w, h), // back panel is hidden — not banded
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

/** One placed instance → its content panel, sized from the section it sits in. */
function instancePart(block: Block, inst: Instance): Part | null {
  const section = sectionById(block, inst.sectionId);
  const component = componentById(block, inst.componentId);
  if (!section || !component) return null;
  // First slice handles shelves; other roles return null until their step.
  if (component.role === "internal_shelf") {
    const length = section.box.w - 2 * BOARD_MM10; // span between sides / dividers (X)
    const width = section.box.d; // depth (Y)
    // Banded on the FRONT edge (Face 1 = edges[0] = the Y=Width depth-front edge) — see frontBand().
    return panel(`${block.id}__inst_${inst.id}`, component.name, length, width, frontBand());
  }
  return null;
}

/**
 * The parametric solve: structural model → flat manufacturing `Part[]`.
 * Feed the result to `solveFull` / `solveAndExportSWJ008` (it slots in exactly where
 * hand-authored parts used to).
 */
export function solveStructure(model: StructuralModel): Part[] {
  const parts: Part[] = [];
  for (const block of model.blocks) {
    parts.push(...carcassParts(block));
    for (const line of block.lines) parts.push(dividerPart(block, line));
    for (const inst of block.instances) {
      const part = instancePart(block, inst);
      if (part) parts.push(part);
    }
  }
  return parts;
}
