// engine/structure/operations.ts — S1-B structural operations.
//
// The Construction-mode editing primitives the UI drives (DB/19_FUNCTION_MAP.md
// §3-4, CONSTRUCTION_FRAME_v2.md §3 T0, :166, :247), expressed as PURE functions
// over the S1-A contract in ../contracts/structure.ts:
//
//   divideSection   — split a leaf section (direct / ratio / equal-N / fixed-mm)
//   moveLine        — move a divider with a Scope (local | line | row | global),
//                     reflowing the adjacent sections
//   selectByTap     — group-first selection: a tapped part → its whole Component
//                     (Тип) + the blast radius of sibling instances (L0)
//   detachInstance  — make one instance an exception (✂); reattachInstance undoes it
//
// LAWS (enforced throughout):
//   • PURE + IMMUTABLE — every function returns a NEW model; no input is ever
//     mutated. Untouched sub-trees are returned by reference ("transform, not
//     rebuild"); only the changed spine is re-allocated.
//   • mm10 INTEGERS — every coordinate stays an integer tenth-of-mm. All splits
//     round to mm10 and CONSERVE the parent extent (no drift, no off-by-one).
//
// ERROR POLICY (a decision S1-B makes; flagged for Planner in S1-B_TEST_PLAN §7):
//   • structural faults (unknown id, non-leaf divide, invalid params, a reflow
//     that would collapse a section to ≤ 0) THROW — a pure engine API should not
//     silently swallow a malformed edit.
//   • semantic no-ops (delta 0, divide-into-1, fixed step ≥ extent) return the
//     input model/section UNCHANGED (same reference).

import type {
  Axis,
  Block,
  Box3D,
  Component,
  ComponentId,
  Instance,
  InstanceId,
  Line,
  LineId,
  Scope,
  Section,
  SectionId,
  StructuralModel,
  Zone,
} from "../contracts/structure.js";
import type { mm10, PartId } from "../contracts/types.js";

// ---------------------------------------------------------------------------
// Geometry helpers (axis-addressed Box3D math, all mm10)
// ---------------------------------------------------------------------------

/** Extent of a box along an axis: x→w, y→h, z→d. */
function extentOf(box: Box3D, axis: Axis): mm10 {
  return axis === "x" ? box.w : axis === "y" ? box.h : box.d;
}

/** Origin of a box along an axis: x→x, y→y, z→z. */
function originOf(box: Box3D, axis: Axis): mm10 {
  return axis === "x" ? box.x : axis === "y" ? box.y : box.z;
}

/** New box with one axis's origin + extent replaced; the other two axes survive. */
function withAxis(box: Box3D, axis: Axis, origin: mm10, extent: mm10): Box3D {
  if (axis === "x") return { ...box, x: origin, w: extent };
  if (axis === "y") return { ...box, y: origin, h: extent };
  return { ...box, z: origin, d: extent };
}

// ===========================================================================
// 1 · divideSection — CONSTRUCTION_FRAME_v2.md:247
// ===========================================================================

/**
 * How a section is split. Every variant carries the `axis` it cuts along.
 *   direct  — one cut at an absolute block-local coordinate (tap-to-place)
 *   ratio   — proportional cuts, e.g. 1:1:0.6 (founder's example)
 *   equal   — N equal sub-sections
 *   fixed   — a cut every `step_mm10`, remainder kept as the last section
 */
export type DivideMode =
  | { readonly kind: "direct"; readonly axis: Axis; readonly at_mm10: mm10 }
  | { readonly kind: "ratio"; readonly axis: Axis; readonly ratio: readonly number[] }
  | { readonly kind: "equal"; readonly axis: Axis; readonly count: number }
  | { readonly kind: "fixed"; readonly axis: Axis; readonly step_mm10: mm10 };

/**
 * Divide the leaf section `sectionId` inside `model` and return the NEW model
 * (Planner contract sign-off 2026-06-27: every mutator returns a `StructuralModel`
 * so the UI always holds the whole model). The freshly-created first-class
 * `Line`s are spliced into the owning `Block.lines`, and the section subtree is
 * replaced in its zone tree.
 *
 * No-op (returns the same model reference) for a 1-way split / a fixed step that
 * doesn't fit. Throws if `sectionId` is unknown, the section is not a leaf, or
 * the mode parameters are invalid.
 */
export function divideSection(
  model: StructuralModel,
  sectionId: SectionId,
  mode: DivideMode,
): StructuralModel {
  const located = findSection(model, sectionId);
  if (!located) throw new Error("DIVIDE_SECTION_NOT_FOUND");

  const { section: divided, lines } = splitLeaf(located.section, mode);
  if (lines.length === 0) return model; // semantic no-op

  const blocks = model.blocks.map((block) => {
    if (block.id !== located.block.id) return block;
    const zones = block.zones.map((z) => {
      const root = replaceSection(z.root, sectionId, divided);
      return root === z.root ? z : ({ ...z, root } as Zone);
    });
    return { ...block, zones, lines: [...block.lines, ...lines] };
  });

  return { ...model, blocks };
}

/** Section-level split (private): a leaf → parent-with-children + the new lines.
 *  Section stores only line *ids*, so the `Line` objects travel back separately
 *  for `divideSection` to splice into `Block.lines`. */
function splitLeaf(
  section: Section,
  mode: DivideMode,
): { readonly section: Section; readonly lines: readonly Line[] } {
  if (section.children.length > 0) {
    throw new Error("DIVIDE_SECTION_NOT_LEAF");
  }

  const { axis } = mode;
  const origin = originOf(section.box, axis);
  const extent = extentOf(section.box, axis);
  const end = origin + extent;

  // Interior cut positions, strictly between origin and end, ascending.
  const cuts = cutPositions(mode, origin, extent);
  if (cuts.length === 0) {
    // No-op split (count 1, single ratio, step ≥ extent): nothing changes.
    return { section, lines: [] };
  }

  // Boundaries tile the extent: [origin, ...cuts, end] → N+1 children.
  const boundaries = [origin, ...cuts, end];

  const lines: Line[] = cuts.map((position, i) => ({
    id: `${section.id}::d${i}`,
    axis,
    position_mm10: position,
    boundsPartIds: [],
    groupId: null,
  }));

  const children: Section[] = boundaries.slice(0, -1).map((lo, i) => {
    const hi = boundaries[i + 1]!;
    return {
      id: `${section.id}::s${i}`,
      box: withAxis(section.box, axis, lo, hi - lo),
      dividers: [],
      children: [],
      // Existing content stays in the model: it lands in the first child so a
      // non-leaf parent keeps `instanceIds` empty (the S1-A contract invariant).
      instanceIds: i === 0 ? section.instanceIds : [],
      purpose: null,
    };
  });

  const dividedSection: Section = {
    ...section,
    dividers: lines.map((l) => l.id),
    children,
    instanceIds: [],
  };

  return { section: dividedSection, lines };
}

/** Compute the interior cut coordinates (block-local, ascending) for a mode. */
function cutPositions(mode: DivideMode, origin: mm10, extent: mm10): mm10[] {
  const end = origin + extent;

  switch (mode.kind) {
    case "direct": {
      const at = mode.at_mm10;
      if (!Number.isInteger(at)) throw new Error("DIVIDE_NON_INTEGER_POSITION");
      if (at <= origin || at >= end) throw new Error("DIVIDE_OUT_OF_BOUNDS");
      return [at];
    }

    case "equal": {
      const n = mode.count;
      if (!Number.isInteger(n) || n < 1) throw new Error("DIVIDE_INVALID_COUNT");
      if (n === 1) return [];
      // Cumulative rounding off the running total keeps the sum exact (no drift).
      const cuts: mm10[] = [];
      for (let i = 1; i < n; i += 1) cuts.push(origin + Math.round((extent * i) / n));
      return dedupeInterior(cuts, origin, end);
    }

    case "ratio": {
      const r = mode.ratio;
      if (r.length === 0 || r.some((v) => !(v > 0))) throw new Error("DIVIDE_INVALID_RATIO");
      if (r.length === 1) return [];
      const total = r.reduce((s, v) => s + v, 0);
      const cuts: mm10[] = [];
      let run = 0;
      for (let i = 0; i < r.length - 1; i += 1) {
        run += r[i]!;
        cuts.push(origin + Math.round((extent * run) / total));
      }
      return dedupeInterior(cuts, origin, end);
    }

    case "fixed": {
      const step = mode.step_mm10;
      if (!Number.isInteger(step) || step <= 0) throw new Error("DIVIDE_INVALID_STEP");
      if (step >= extent) return []; // remainder == whole section: no cut
      const cuts: mm10[] = [];
      for (let pos = origin + step; pos < end; pos += step) cuts.push(pos);
      return cuts;
    }
  }
}

/** Drop cuts that landed on (or past) a boundary or duplicated a neighbour, so
 *  every resulting child has width > 0. Keeps the split well-formed. */
function dedupeInterior(cuts: readonly mm10[], origin: mm10, end: mm10): mm10[] {
  const out: mm10[] = [];
  for (const c of cuts) {
    if (c <= origin || c >= end) continue;
    if (out.length > 0 && c === out[out.length - 1]) continue;
    out.push(c);
  }
  return out;
}

/** Locate a section (anywhere in any zone tree) and the block that owns it. */
function findSection(
  model: StructuralModel,
  sectionId: SectionId,
): { block: Block; section: Section } | null {
  for (const block of model.blocks) {
    let hit: Section | null = null;
    forEachSection(block, (s) => {
      if (!hit && s.id === sectionId) hit = s;
    });
    if (hit) return { block, section: hit };
  }
  return null;
}

/** Return a section tree with `targetId` replaced by `replacement`. Untouched
 *  branches are returned by reference; the input tree is never mutated. */
function replaceSection(section: Section, targetId: SectionId, replacement: Section): Section {
  if (section.id === targetId) return replacement;
  if (section.children.length === 0) return section;
  const children = section.children.map((c) => replaceSection(c, targetId, replacement));
  return children.some((c, i) => c !== section.children[i]) ? { ...section, children } : section;
}

// ===========================================================================
// 1b · mergeSections — the inverse of divideSection (blocker #2, v3 §9)
// ===========================================================================

/**
 * Merge 2+ ADJACENT sibling leaf sections back into one — the inverse of
 * `divideSection`. Removes the divider `Line`s between them (from the parent's
 * `dividers` and `Block.lines`), unions their boxes along the divide axis, and
 * concatenates their content; every `Instance` that sat in a merged child is
 * re-pointed to the surviving section. If EVERY child of the parent is merged,
 * the parent reverts to a leaf — the exact inverse of a divide.
 *
 * No-op (same reference) for fewer than 2 distinct ids. Throws if the ids are not
 * direct siblings of one parent (`MERGE_NOT_SIBLINGS`), not contiguous in the
 * tiling (`MERGE_NOT_CONTIGUOUS`), or any merged child is itself non-leaf
 * (`MERGE_NON_LEAF_CHILD`).
 */
export function mergeSections(
  model: StructuralModel,
  sectionIds: readonly SectionId[],
): StructuralModel {
  const ids = new Set(sectionIds);
  if (ids.size < 2) return model; // nothing to merge

  const found = findMergeParent(model, ids);
  if (!found) throw new Error("MERGE_NOT_SIBLINGS");
  const { block, parent } = found;

  // Positions of the merged children in the parent's tiling; must be contiguous.
  const idxs = parent.children.map((c, i) => (ids.has(c.id) ? i : -1)).filter((i) => i >= 0);
  if (idxs.length !== ids.size) throw new Error("MERGE_NOT_SIBLINGS");
  const lo = idxs[0]!;
  const hi = idxs[idxs.length - 1]!;
  if (hi - lo + 1 !== idxs.length) throw new Error("MERGE_NOT_CONTIGUOUS");

  const merged = parent.children.slice(lo, hi + 1);
  if (merged.some((c) => c.children.length > 0)) throw new Error("MERGE_NON_LEAF_CHILD");

  // Union the boxes along the divide axis (the axis on which adjacent children differ).
  const axis = divideAxisOf(merged[0]!.box, merged[1]!.box);
  const start = originOf(merged[0]!.box, axis);
  const lastBox = merged[merged.length - 1]!.box;
  const span = originOf(lastBox, axis) + extentOf(lastBox, axis) - start;
  const unionBox = withAxis(merged[0]!.box, axis, start, span);

  const mergedInstanceIds = merged.flatMap((c) => c.instanceIds);
  const mergedPurpose = merged.find((c) => c.purpose !== null)?.purpose ?? null;
  const mergedChildIds = new Set(merged.map((c) => c.id));

  // Divider lines strictly between the merged children (parent.dividers[lo..hi-1]).
  const removedLineIds = new Set(parent.dividers.slice(lo, hi));

  let newParent: Section;
  let targetSectionId: SectionId;
  if (merged.length === parent.children.length) {
    // All children merged → parent reverts to a leaf (exact inverse of divide).
    targetSectionId = parent.id;
    newParent = { ...parent, dividers: [], children: [], instanceIds: mergedInstanceIds, purpose: mergedPurpose };
  } else {
    // Subset merge → one new leaf child replaces the merged range.
    targetSectionId = merged[0]!.id;
    const mergedChild: Section = {
      id: targetSectionId,
      box: unionBox,
      dividers: [],
      children: [],
      instanceIds: mergedInstanceIds,
      purpose: mergedPurpose,
    };
    newParent = {
      ...parent,
      children: [...parent.children.slice(0, lo), mergedChild, ...parent.children.slice(hi + 1)],
      dividers: parent.dividers.filter((id) => !removedLineIds.has(id)),
    };
  }

  const blocks = model.blocks.map((b) => {
    if (b.id !== block.id) return b;
    const zones = b.zones.map((z) => {
      const root = replaceSection(z.root, parent.id, newParent);
      return root === z.root ? z : ({ ...z, root } as Zone);
    });
    const lines = b.lines.filter((l) => !removedLineIds.has(l.id));
    const instances = b.instances.map((inst) =>
      mergedChildIds.has(inst.sectionId) && inst.sectionId !== targetSectionId
        ? { ...inst, sectionId: targetSectionId }
        : inst,
    );
    return { ...b, zones, lines, instances };
  });

  return { ...model, blocks };
}

/** Find the section whose DIRECT children include every id in `ids`. */
function findMergeParent(
  model: StructuralModel,
  ids: Set<SectionId>,
): { block: Block; parent: Section } | null {
  const wanted = [...ids];
  for (const block of model.blocks) {
    let hit: Section | null = null;
    forEachSection(block, (s) => {
      if (!hit && s.children.length > 0 && wanted.every((id) => s.children.some((c) => c.id === id))) {
        hit = s;
      }
    });
    if (hit) return { block, parent: hit };
  }
  return null;
}

/** The axis on which two adjacent sibling boxes differ (their divide axis). */
function divideAxisOf(a: Box3D, b: Box3D): Axis {
  if (a.x !== b.x) return "x";
  if (a.y !== b.y) return "y";
  return "z";
}

// ===========================================================================
// 2 · moveLine — DB/19_FUNCTION_MAP.md §3.4 + §4 (scope)
// ===========================================================================

/**
 * Move the divider `lineId` by `delta` mm10, reflowing the sections it bounds.
 * `scope` widens the reach (UI: Локально · Линия · Ряд · Все):
 *   local  — only this line
 *   line   — every line sharing this line's `groupId` (aligned group; UI default)
 *   row    — every same-axis divider of a section in a Row that contains this
 *            line's parent section ("every carcass in the row")
 *   global — every same-axis line in the whole model
 *
 * NOTE (S1-B_TEST_PLAN §7, for Planner): `row` keys off the divider's PARENT
 * section being listed in a Row. `global` is "same axis across the model". Both
 * are deliberate, documented readings of the under-specified scope semantics.
 *
 * Returns the input model unchanged when `delta === 0`. Throws if `lineId` is
 * unknown, `delta` is non-integer, or the reflow would collapse a section ≤ 0.
 */
export function moveLine(
  model: StructuralModel,
  lineId: LineId,
  delta: mm10,
  scope: Scope,
): StructuralModel {
  if (!Number.isInteger(delta)) throw new Error("MOVELINE_NON_INTEGER_DELTA");

  const found = findLine(model, lineId);
  if (!found) throw new Error("MOVELINE_LINE_NOT_FOUND");
  if (delta === 0) return model;

  const targets = resolveScope(model, found.block, found.line, scope);
  const axisOf = new Map<LineId, Axis>();
  for (const block of model.blocks) {
    for (const l of block.lines) if (targets.has(l.id)) axisOf.set(l.id, l.axis);
  }

  const blocks = model.blocks.map((block) => {
    const blockTargets = new Set<LineId>();
    for (const l of block.lines) if (targets.has(l.id)) blockTargets.add(l.id);
    if (blockTargets.size === 0) return block; // untouched block, same reference

    const lines = block.lines.map((l) =>
      blockTargets.has(l.id) ? { ...l, position_mm10: l.position_mm10 + delta } : l,
    );
    const zones = block.zones.map((z) => {
      const root = reflowSection(z.root, blockTargets, axisOf, delta);
      return root === z.root ? z : ({ ...z, root } as Zone);
    });
    return { ...block, lines, zones };
  });

  return { ...model, blocks };
}

/** Reflow a section's children around any moved divider it owns (depth-first). */
function reflowSection(
  section: Section,
  targets: ReadonlySet<LineId>,
  axisOf: ReadonlyMap<LineId, Axis>,
  delta: mm10,
): Section {
  // Recurse first so a moved divider deep in the tree is handled before us.
  let children = section.children.map((c) => reflowSection(c, targets, axisOf, delta));
  let changed = children.some((c, i) => c !== section.children[i]);

  for (let d = 0; d < section.dividers.length; d += 1) {
    const lineId = section.dividers[d]!;
    if (!targets.has(lineId)) continue;
    const axis = axisOf.get(lineId)!;
    const left = children[d]!;
    const right = children[d + 1]!;

    const newLeftExtent = extentOf(left.box, axis) + delta;
    const newRightExtent = extentOf(right.box, axis) - delta;
    if (newLeftExtent <= 0 || newRightExtent <= 0) {
      throw new Error("MOVELINE_SECTION_COLLAPSE");
    }

    const newLeft: Section = {
      ...left,
      box: withAxis(left.box, axis, originOf(left.box, axis), newLeftExtent),
    };
    const newRight: Section = {
      ...right,
      box: withAxis(right.box, axis, originOf(right.box, axis) + delta, newRightExtent),
    };
    children = children.map((c, i) => (i === d ? newLeft : i === d + 1 ? newRight : c));
    changed = true;
  }

  return changed ? { ...section, children } : section;
}

/** Locate a line and the block that owns it. */
function findLine(model: StructuralModel, lineId: LineId): { block: Block; line: Line } | null {
  for (const block of model.blocks) {
    const line = block.lines.find((l) => l.id === lineId);
    if (line) return { block, line };
  }
  return null;
}

/** Resolve the set of line ids a scoped move touches (always includes the line).
 *  `line` (by groupId) and `global` (by axis) reach across the whole model —
 *  aligned lines can span carcasses/blocks. `local` and `row` stay block-local
 *  (a Row is a block-level composition). */
function resolveScope(
  model: StructuralModel,
  block: Block,
  line: Line,
  scope: Scope,
): ReadonlySet<LineId> {
  const out = new Set<LineId>([line.id]);
  if (scope === "local") return out;

  if (scope === "line") {
    if (line.groupId !== null) {
      for (const b of model.blocks) {
        for (const l of b.lines) if (l.groupId === line.groupId) out.add(l.id);
      }
    }
    return out;
  }

  if (scope === "global") {
    for (const b of model.blocks) {
      for (const l of b.lines) if (l.axis === line.axis) out.add(l.id);
    }
    return out;
  }

  // scope === "row": same-axis dividers of sections sharing a Row with our parent.
  const parent = dividerParent(block, line.id);
  if (!parent) return out;
  const rowSectionIds = new Set<string>();
  for (const row of block.rows) {
    if (row.sectionIds.includes(parent.id)) {
      for (const sid of row.sectionIds) rowSectionIds.add(sid);
    }
  }
  if (rowSectionIds.size === 0) return out;
  forEachSection(block, (sec) => {
    if (!rowSectionIds.has(sec.id)) return;
    for (const did of sec.dividers) {
      const dl = block.lines.find((l) => l.id === did);
      if (dl && dl.axis === line.axis) out.add(dl.id);
    }
  });
  return out;
}

/** The section whose `dividers` contains `lineId`, or null. */
function dividerParent(block: Block, lineId: LineId): Section | null {
  let hit: Section | null = null;
  forEachSection(block, (sec) => {
    if (!hit && sec.dividers.includes(lineId)) hit = sec;
  });
  return hit;
}

/** Visit every section in a block's zone trees, depth-first. */
function forEachSection(block: Block, visit: (s: Section) => void): void {
  const walk = (s: Section): void => {
    visit(s);
    for (const c of s.children) walk(c);
  };
  for (const z of block.zones) walk(z.root);
}

// ===========================================================================
// 3 · selectByTap — group-first selection (L0, CONSTRUCTION_FRAME_v2.md:166)
// ===========================================================================

/**
 * The result of tapping a part: the Component (Тип) it belongs to and the blast
 * radius — the instances an edit would change. A linked tap selects the whole
 * type (all LINKED siblings). A tap that lands on a detached instance's private
 * parts selects only that one exception.
 */
export interface Selection {
  readonly componentId: ComponentId;
  readonly instanceIds: readonly InstanceId[];
  readonly detached: boolean;
}

/**
 * Resolve a tapped `partId` to a group-first selection, or `null` if no
 * component owns it. Detached instances (which carry their own `partIds`
 * override) resolve to themselves alone; the shared type resolves to all of its
 * linked instances — the blast radius shown before any edit.
 */
export function selectByTap(model: StructuralModel, partId: PartId): Selection | null {
  for (const block of model.blocks) {
    // A detached instance that owns a part DIVERGED from its type (a part not in
    // the shared definition) is a one-off exception: tapping it selects just it.
    // A detached-but-unchanged instance still shares the type's parts, so tapping
    // a shared part falls through to the group below (the exception is excluded).
    for (const inst of block.instances) {
      if (inst.link !== "detached" || !inst.partIds) continue;
      const comp = block.components.find((c) => c.id === inst.componentId);
      const ownsDiverged = inst.partIds.includes(partId) && !comp?.partIds.includes(partId);
      if (ownsDiverged) {
        return { componentId: inst.componentId, instanceIds: [inst.id], detached: true };
      }
    }
    // Otherwise the part belongs to a shared type → select every linked sibling.
    const component = block.components.find((c) => c.partIds.includes(partId));
    if (component) {
      const instanceIds = block.instances
        .filter((i) => i.componentId === component.id && i.link !== "detached")
        .map((i) => i.id);
      return { componentId: component.id, instanceIds, detached: false };
    }
  }
  return null;
}

// ===========================================================================
// 4 · detachInstance / reattachInstance — exceptions (T0, FRAME :147, :150)
// ===========================================================================

/**
 * Make `instanceId` a detached exception (✂): flip its link and snapshot its
 * Component's parts into a private `partIds` override so it can diverge without
 * dragging its siblings. The "✂ N" readout (`countExceptions`) rises by one.
 * Idempotent — re-detaching returns the model unchanged. Throws if unknown.
 */
export function detachInstance(model: StructuralModel, instanceId: InstanceId): StructuralModel {
  return mapInstance(model, instanceId, (inst, component) => {
    if (inst.link === "detached") return inst; // already an exception → no-op
    const partIds: readonly PartId[] = [...component.partIds];
    return { ...inst, link: "detached", partIds };
  });
}

/**
 * Re-link `instanceId` to its Component (clears the ✂ override), dropping the
 * exception so it follows the shared definition again. `countExceptions` falls
 * by one. Idempotent — re-attaching a linked instance is a no-op. Throws if
 * unknown.
 */
export function reattachInstance(model: StructuralModel, instanceId: InstanceId): StructuralModel {
  return mapInstance(model, instanceId, (inst) => {
    if (inst.link === "linked") return inst; // already linked → no-op
    return { ...inst, link: "linked", partIds: null };
  });
}

/** Kinds the UI's "Add" verb can place. First slice supports `"shelf"`. */
export type AddKind = "shelf" | "rail" | "divider" | "drawer" | "door";

/**
 * Add a content instance to a leaf section and return the NEW model. First slice:
 * a shelf (`internal_shelf`) — reusing the block's shelf Component (or creating one),
 * then redistributing every shelf in that section to evenly-spaced heights so the result
 * looks right. No-op for kinds not yet supported. Throws on unknown / non-leaf section
 * (same error policy as divideSection).
 */
export function addInstance(
  model: StructuralModel,
  sectionId: SectionId,
  kind: AddKind = "shelf",
): StructuralModel {
  if (kind !== "shelf") return model; // other kinds land in later slices

  const located = findSection(model, sectionId);
  if (!located) throw new Error("ADD_INSTANCE_SECTION_NOT_FOUND");
  const { block, section } = located;
  if (section.children.length > 0) throw new Error("ADD_INSTANCE_SECTION_NOT_LEAF");

  const roleOf = (inst: Instance) =>
    block.components.find((c) => c.id === inst.componentId)?.role ?? null;

  // find or create the shelf component (role internal_shelf)
  let shelf = block.components.find((c) => c.role === "internal_shelf") ?? null;
  let components = block.components;
  if (!shelf) {
    shelf = { id: `${block.id}__cmp_shelf`, name: "Полка", partIds: [], role: "internal_shelf" };
    components = [...block.components, shelf];
  }

  const newId = `shelf_${block.instances.length + 1}`;

  // every shelf now living in this section, in order, gets an evenly-spaced height
  const order = [
    ...block.instances
      .filter((i) => i.sectionId === sectionId && roleOf(i) === "internal_shelf")
      .map((i) => i.id),
    newId,
  ];
  const n = order.length;
  const yAt = (idx: number) => Math.round(section.box.y + (section.box.h * (idx + 1)) / (n + 1));

  const instances: Instance[] = block.instances.map((i) => {
    const idx = order.indexOf(i.id);
    return idx === -1 ? i : { ...i, anchor: { ...i.anchor, y: yAt(idx) } };
  });
  instances.push({
    id: newId,
    componentId: shelf.id,
    sectionId,
    anchor: { x: section.box.x, y: yAt(n - 1), z: section.box.z },
    link: "linked",
  });

  const newSection: Section = { ...section, instanceIds: [...section.instanceIds, newId] };
  const zones = block.zones.map((z) => {
    const root = replaceSection(z.root, sectionId, newSection);
    return root === z.root ? z : { ...z, root };
  });

  const newBlock: Block = { ...block, components, instances, zones };
  return { ...model, blocks: model.blocks.map((b) => (b.id === block.id ? newBlock : b)) };
}

/** Apply `transform` to one instance (by id), rebuilding only the spine to it.
 *  Returns the same model reference when the transform is a no-op. Throws if the
 *  instance — or its component — cannot be found. */
function mapInstance(
  model: StructuralModel,
  instanceId: InstanceId,
  transform: (inst: Instance, component: Component) => Instance,
): StructuralModel {
  let seen = false;
  const blocks = model.blocks.map((block) => {
    const idx = block.instances.findIndex((i) => i.id === instanceId);
    if (idx === -1) return block;
    seen = true;
    const inst = block.instances[idx]!;
    const component = block.components.find((c) => c.id === inst.componentId);
    if (!component) throw new Error("INSTANCE_COMPONENT_NOT_FOUND");
    const next = transform(inst, component);
    if (next === inst) return block; // no-op → preserve reference
    const instances = block.instances.map((i, k) => (k === idx ? next : i));
    return { ...block, instances };
  });
  if (!seen) throw new Error("INSTANCE_NOT_FOUND");
  return blocks.every((b, i) => b === model.blocks[i]) ? model : { ...model, blocks };
}
