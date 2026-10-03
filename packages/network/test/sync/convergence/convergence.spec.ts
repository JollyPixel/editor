// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import { Choices } from "./Choices.ts";
import {
  simulate,
  type SimulationOptions
} from "./Simulation.ts";

// CONSTANTS
const kRuns = 1_000;
const kMaxChoice = 255;
const kChoices = fc.array(fc.nat({ max: kMaxChoice }), {
  maxLength: 1_000,
  size: "max"
});

function assertConverges(
  options: Omit<SimulationOptions, "choices">
): void {
  fc.assert(
    fc.property(kChoices, (stream) => {
      const { server, views } = simulate({
        ...options,
        choices: new Choices(stream)
      });

      assert.deepStrictEqual(views, views.map(() => server));
    }),
    { numRuns: kRuns }
  );
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
});
