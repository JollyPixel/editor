// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import type {
  LanternSession,
  SessionOutcome,
  StepEnter,
  TourStepOptions
} from "#src/index.ts";

declare const session: LanternSession;

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

describe("LanternSession", () => {
  test("end listeners receive the outcome", () => {
    session.on("end", (outcome) => {
      expect(outcome).type.toBe<SessionOutcome>();
    });
  });
});
