// Layer 4 (structural extension) — the Construction-mode object model.
//
// This is the engine contract the Construction UI demands and that a flat
// "list of cabinet boxes" cannot express (DB/19_FUNCTION_MAP.md §3,
// CONSTRUCTION_FRAME_v2.md:159-166). It is an OVERLAY on the manufacturing
// model in ./types.ts: the leaf of the hierarchy is exactly the existing
// `Part` (Деталь), referenced by id. Nothing here changes the SWJ008 path.
//
// SELECTION HIERARCHY (CONSTRUCTION_FRAME_v2.md:159-164):
//   Block  (Блок — cabinet, the group, level 1)
//     └─ Zone  (Зона — a subdivision created by a rule)
//          └─ Component / Тип  (reusable definition, placed 1..N — level 2)
//               └─ Part  (Деталь — one physical panel, the leaf; ./types.ts)
//
// STRUCTURAL MECHANICS (DB/19_FUNCTION_MAP.md §3): first-class `Line`s split a
// volume into recursive `Section`s; `Row`s compose carcasses across the wall;
// dimensional edits carry a `Scope`.
//
// UNITS: every coordinate / dimension is an `mm10` integer (tenths of a mm),
// same convention as ./types.ts. Floats never appear here.
//
// IMMUTABILITY: every field is `readonly` and every collection is a
// `readonly[]`. Structural operations (S1-B) return NEW models; nothing here is
// ever mutated in place ("transform, not rebuild").

import type { mm10, Part, PartId } from "./types.js";

// ---------------------------------------------------------------------------
// Identifiers (plain strings, like the rest of the contract; aliased for reading)
// ---------------------------------------------------------------------------

export type BlockId = string;
export type ZoneId = string;
export type LineId = string;
export type LineGroupId = string;
export type SectionId = string;
export type RowId = string;
export type ComponentId = string;
export type InstanceId = string;

// ---------------------------------------------------------------------------
// Geometry (block-local mm10 frame)
// ---------------------------------------------------------------------------

/** Axis a `Line` divides along / a coordinate is measured on (block-local). */
export type Axis = "x" | "y" | "z";

/** An axis-aligned volume in block-local mm10 coordinates. Mirrors the runtime
 *  `bbox` shape in ./types.ts ({x,y,z} origin, {w,h,d} extents). */
export interface Box3D {
  readonly x: mm10;
  readonly y: mm10;
  readonly z: mm10;
  readonly w: mm10;
  readonly h: mm10;
  readonly d: mm10;
}

/** A placement anchor (offset of an instance within its section), block-local. */
export interface Anchor3D {
  readonly x: mm10;
  readonly y: mm10;
  readonly z: mm10;
}

// ---------------------------------------------------------------------------
// Scope — the heart of "group/global first" (DB/19_FUNCTION_MAP.md §4)
// ---------------------------------------------------------------------------

/**
 * The reach of a dimensional edit. UI label `Локально · Линия · Ряд · Все`.
 *   local  — this section only
 *   line   — the aligned line-group ("the overall lines of the furniture") — UI default
 *   row    — every carcass in the row (base / upper / tall)
 *   global — the whole model (depth edits default here, per founder)
 * S1-B's `moveLine(model, lineId, delta, scope)` is a thin wrapper over this.
 */
export type Scope = "local" | "line" | "row" | "global";

// ---------------------------------------------------------------------------
// Domain tags (DB/19_FUNCTION_MAP.md §3.5–3.6)
// ---------------------------------------------------------------------------

/** Panel role → per-role material + thickness resolution (load-bearing for the
 *  Материалы phase and the sheet counter). */
export type PanelRole =
  | "carcass_side"
  | "carcass_back"
  | "carcass_bottom"
  | "carcass_top"
  | "facade"
  | "internal_shelf";

/** Purpose tag on a section → load class → physics gate input (closes the loop
 *  with doc 16 §4). */
export type SectionPurpose =
  | "storage"
  | "hanging"
  | "appliance"
  | "drawer"
  | "display"
  | "structural";

/** Composition kind of a `Row` above the carcasses. */
export type RowKind = "base" | "upper" | "tall";

// ---------------------------------------------------------------------------
// Line — first-class entity (DB/19_FUNCTION_MAP.md §3.1)
// ---------------------------------------------------------------------------

/**
 * A dividing line: id, axis, position, the parts it bounds, and group
 * membership. Lines aligned across sections / carcasses share a `groupId` —
 * the "overall lines of the furniture" the founder described — so a `line`-scope
 * edit moves the whole group at once.
 */
export interface Line {
  readonly id: LineId;
  readonly axis: Axis;
  readonly position_mm10: mm10;
  /** Parts (Деталь leaves) this line physically bounds. */
  readonly boundsPartIds: readonly PartId[];
  /** Aligned-line group, or `null` when the line stands alone. */
  readonly groupId: LineGroupId | null;
}

// ---------------------------------------------------------------------------
// Section — recursive (DB/19_FUNCTION_MAP.md §3.3)
// ---------------------------------------------------------------------------

/**
 * A volume split by lines into child sections; children split further. Content
 * (shelves / drawers / doors, modelled as component `Instance`s) attaches to a
 * LEAF section (`children` empty). A non-leaf section's `instanceIds` is empty.
 */
export interface Section {
  readonly id: SectionId;
  readonly box: Box3D;
  /** Lines that split THIS section into `children`. Empty = leaf section. */
  readonly dividers: readonly LineId[];
  /** Child sections produced by `dividers`. Empty = leaf section. */
  readonly children: readonly Section[];
  /** Component placements living in this leaf section. */
  readonly instanceIds: readonly InstanceId[];
  /** Purpose → load class input. `null` until tagged. */
  readonly purpose: SectionPurpose | null;
}

// ---------------------------------------------------------------------------
// Zone — rule-driven subdivision (CONSTRUCTION_FRAME_v2.md:161)
// ---------------------------------------------------------------------------

/** Provenance of a `Zone`: the rule that produced the subdivision, so it can be
 *  re-solved. (The divide algorithms themselves live in S1-B operations.) */
export type ZoneRule = "manual" | "ratio" | "equal" | "fixed_mm";

/**
 * A named, rule-driven subdivision of a block (selection level between Block and
 * Component). It owns the root of a recursive `Section` tree; the tap-cycle
 * `block → zone → type → single` lands on this level as the coarse step.
 */
export interface Zone {
  readonly id: ZoneId;
  readonly name: string;
  readonly rule: ZoneRule;
  readonly root: Section;
}

// ---------------------------------------------------------------------------
// Component (Тип) + Instance — reusable definition placed 1..N
// ---------------------------------------------------------------------------

/**
 * A reusable definition (Тип): the leaf `Part`s that make up one placement (a
 * shelf = one part; a drawer = several). Placed 1..N times as `Instance`s.
 * Group-first selection (L0): tapping any member part selects the whole
 * Component and highlights every sibling instance (the blast radius).
 */
export interface Component {
  readonly id: ComponentId;
  readonly name: string;
  /** The leaf Part(s) (Деталь) composing a single placement of this type. */
  readonly partIds: readonly PartId[];
  /** Dominant panel role of the type, when it has one. */
  readonly role: PanelRole | null;
}

/** Whether an instance follows its Component definition or overrides it. */
export type InstanceLink = "linked" | "detached";

/**
 * One placement of a `Component` in a section.
 * `link`: `"linked"` (default) follows the shared definition; `"detached"` (✂)
 * is an EXCEPTION that overrides it. Detached instances are exactly what the
 * "✂ N" exceptions readout counts (CONSTRUCTION_FRAME_v2.md:150).
 */
export interface Instance {
  readonly id: InstanceId;
  readonly componentId: ComponentId;
  readonly sectionId: SectionId;
  readonly anchor: Anchor3D;
  readonly link: InstanceLink;
  /**
   * Per-instance part override (S1-B). `null`/absent = LINKED: the instance
   * inherits its `Component.partIds` (the shared definition). A populated list =
   * DETACHED (✂): a private snapshot the instance owns so it can diverge from the
   * type without dragging its siblings. `detachInstance` snapshots the component's
   * parts here; `reattachInstance` clears it back to `null`. Kept OPTIONAL so the
   * S1-A contract (and its fixtures) stay valid — this is a purely additive field.
   */
  readonly partIds?: readonly PartId[] | null;
}

// ---------------------------------------------------------------------------
// Row — composition layer above carcasses (DB/19_FUNCTION_MAP.md §3.2)
// ---------------------------------------------------------------------------

/**
 * A row of sections across carcasses (base / upper / tall), so a structural edit
 * can propagate across the wall — the fix for "added bottom, top unchanged".
 */
export interface Row {
  readonly id: RowId;
  readonly kind: RowKind;
  /** Sections (across carcasses) that belong to this row. */
  readonly sectionIds: readonly SectionId[];
}

// ---------------------------------------------------------------------------
// Block (Блок) — the cabinet (level 1)
// ---------------------------------------------------------------------------

/**
 * A cabinet: outer volume, its rule-driven zones, the reusable component
 * definitions used inside it, every placement of those components, the
 * first-class dividing lines, and the rows it participates in.
 */
export interface Block {
  readonly id: BlockId;
  readonly name: string;
  readonly box: Box3D;
  readonly zones: readonly Zone[];
  readonly components: readonly Component[];
  readonly instances: readonly Instance[];
  readonly lines: readonly Line[];
  readonly rows: readonly Row[];
}

// ---------------------------------------------------------------------------
// StructuralModel — the top container (overlay on the manufacturing Project)
// ---------------------------------------------------------------------------

/**
 * The Construction-mode model: a set of `Block`s over the same flat list of
 * manufacturing `Part`s the SWJ008 path consumes. The structure references parts
 * by id only; `parts` here IS the existing `Project.parts` list, unchanged, so
 * the two views never diverge.
 */
export interface StructuralModel {
  readonly id: string;
  readonly name: string;
  readonly blocks: readonly Block[];
  /** The flat manufacturing leaves (Деталь), shared with the Project. */
  readonly parts: readonly Part[];
}

// ---------------------------------------------------------------------------
// Pure read-only helpers (contract conveniences — no mutation, no operations).
// The structural operations (divide / moveLine / detach) belong to S1-B.
// ---------------------------------------------------------------------------

/** True when an instance is a detached exception (✂). */
export function isDetached(instance: Instance): boolean {
  return instance.link === "detached";
}

/** The exceptions count ("✂ N") for a block: how many instances are detached. */
export function countExceptions(block: Block): number {
  let n = 0;
  for (const instance of block.instances) {
    if (isDetached(instance)) n += 1;
  }
  return n;
}

/** Collect every leaf section (no children) under a section, depth-first. */
export function leafSections(section: Section): readonly Section[] {
  if (section.children.length === 0) return [section];
  const out: Section[] = [];
  for (const child of section.children) {
    out.push(...leafSections(child));
  }
  return out;
}
