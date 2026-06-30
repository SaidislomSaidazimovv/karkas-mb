// S3-E2 — drilling integration (slice 1: System-32 shelf-pin line-boring).
// Proves the Layer-1 primitives, formerly dead code ("defined but never called"), are now
// invoked automatically by the model→parts manufacturing path, and that the drilled set
// stays inside the safety gate. Spec values are still the dummy catalog (verified:false),
// so this asserts the STRUCTURE of the drilling (which panels, paired rows, in-bounds),
// NOT factory-exact coordinates — those land with S3-E7 verified hardware.

import { describe, expect, it } from "vitest";

import { buildDemoModel } from "../engine/structure/demoModel.js";
import { solveStructure } from "../engine/structure/solve.js";
import { solveModelToParts } from "../engine/cnc.js";
import { validateParts } from "../engine/core/validate.js";

describe("S3-E2 drilling integration", () => {
  it("solveStructure alone leaves every panel blank (drilling is a separate pass)", () => {
    const parts = solveStructure(buildDemoModel());
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((p) => p.operations.length === 0)).toBe(true);
  });

  it("the manufacturing path line-bores both side panels of a block with shelves", () => {
    const parts = solveModelToParts(buildDemoModel());
    const sides = parts.filter(
      (p) => p.id.endsWith("__side_l") || p.id.endsWith("__side_r"),
    );
    expect(sides.length).toBe(2);
    for (const side of sides) {
      expect(side.operations.length).toBeGreaterThan(0);
      // Every hole is a Ø-pin face-A drill; front+back rows ⇒ an even count.
      expect(side.operations.every((o) => o.op === "drill" && o.face === "A")).toBe(true);
      expect(side.operations.length % 2).toBe(0);
    }
  });

  it("non-side panels (top/bottom/back/divider/shelf) receive no pin holes", () => {
    const parts = solveModelToParts(buildDemoModel());
    const others = parts.filter(
      (p) => !p.id.endsWith("__side_l") && !p.id.endsWith("__side_r"),
    );
    expect(others.length).toBeGreaterThan(0);
    expect(others.every((p) => p.operations.length === 0)).toBe(true);
  });

  it("the drilled part set passes the machining safety gate (all holes in bounds)", () => {
    const validation = validateParts(solveModelToParts(buildDemoModel()));
    expect(validation.ok).toBe(true);
  });

  it("is pure — same model in produces identical drilling out", () => {
    const a = solveModelToParts(buildDemoModel());
    const b = solveModelToParts(buildDemoModel());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
