// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type * as LanternPackage from "#src/index.ts";
import type {
  TourRun,
  RunOutcome,
  StepEnter,
  TourStepOptions
} from "#src/index.ts";

declare const run: TourRun;

test("only Lantern creates runs and seen records", () => {
  expect<"TourRun">().type.not.toBeAssignableTo<keyof typeof LanternPackage>();
  expect<"LanternSeen">().type.not.toBeAssignableTo<keyof typeof LanternPackage>();
});

describe("TourStepOptions", () => {
  test("a target is a selector list, not a single selector", () => {
    expect<TourStepOptions["target"]>().type.toBeAssignableFrom<readonly string[]>();
    expect<TourStepOptions["target"]>().type.not.toBeAssignableFrom<string>();
  });

  test("enter may return its cleanup, now or later", () => {
    expect<StepEnter>().type.toBeAssignableFrom(() => () => undefined);
    expect<StepEnter>().type.toBeAssignableFrom(async() => () => undefined);
    expect<StepEnter>().type.not.toBeAssignableFrom(() => "cleanup");
  });
});

describe("TourRun", () => {
  test("end listeners receive the outcome", () => {
    run.on("end", (outcome) => {
      expect(outcome).type.toBe<RunOutcome>();
    });
  });
});
