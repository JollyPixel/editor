// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  divergentSeeds,
  simulate,
  type SimulationOptions
} from "./Simulation.ts";

// CONSTANTS
const kSeeds = 1_000;

function assertConverges(
  options: Omit<SimulationOptions, "seed">
): void {
  const failures = divergentSeeds(options, kSeeds);
  if (failures.length > 0) {
    assert.fail(
      `${failures.length}/${kSeeds} seeds diverge, first: ${failures.slice(0, 10).join(", ")}`
    );
  }
}

describe("CommandSync convergence", () => {
  test("registers converge", () => {
    assertConverges({ scenario: "registers" });
  });

  test("an ordered list converges", () => {
    assertConverges({ scenario: "list" });
  });

  test("a parent-pointer tree converges", () => {
    assertConverges({ scenario: "tree" });
  });

  test("mixed commands converge", () => {
    assertConverges({ scenario: "mixed" });
  });

  test("mixed commands converge with more clients and longer edit runs", () => {
    assertConverges({ scenario: "mixed", clients: 5, edits: 20 });
  });

  test("mixed commands converge when list moves cannot be reverted", () => {
    assertConverges({ scenario: "mixed", opaque: ["move"] });
  });

  test("mixed commands converge when conflicts compare timestamps", () => {
    assertConverges({ scenario: "mixed", versioned: false });
  });

  test("a run is deterministic for its seed", () => {
    assert.deepStrictEqual(
      simulate({ seed: 7, scenario: "mixed" }),
      simulate({ seed: 7, scenario: "mixed" })
    );
  });
});
