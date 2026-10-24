// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  TargetPath,
  Tour,
  TourDefinitionError,
  type TourOptions,
  type TourStepOptions
} from "#src/index.ts";
import { step } from "../helpers/tours.ts";

function options(
  overrides: Partial<TourOptions> = {}
): TourOptions {
  return {
    id: "voxel-map.basics",
    version: 1,
    title: "Basics",
    steps: [step("welcome")],
    ...overrides
  };
}

function withStep(
  overrides: Partial<TourStepOptions>
): TourOptions {
  return options({
    steps: [step("welcome", overrides)]
  });
}

describe("Tour", () => {
  test("fills the step defaults", () => {
    const [welcome] = new Tour(options()).steps;

    assert.equal(welcome.side, "below");
    assert.equal(welcome.target, null);
    assert.equal(welcome.image, null);
    assert.equal(welcome.when, null);
    assert.equal(welcome.enter, null);
    assert.equal(welcome.until, null);
  });

  test("turns a selector list into a TargetPath", () => {
    const [welcome] = new Tour(withStep({
      target: ["jolly-editor-toolbar", "[data-tour=save]"]
    })).steps;

    assert.ok(welcome.target instanceof TargetPath);
    assert.deepEqual([...welcome.target], ["jolly-editor-toolbar", "[data-tour=save]"]);
  });

  test("finds a step position by id", () => {
    const tour = new Tour(options({
      steps: [step("welcome"), step("blocks")]
    }));

    assert.equal(tour.stepIndex("blocks"), 1);
    assert.equal(tour.stepIndex("missing"), -1);
  });

  const broken: Array<[string, string, TourOptions]> = [
    ["an id that is not dotted identifiers", "id", options({ id: "voxel map" })],
    ["a version of zero", "version", options({ version: 0 })],
    ["a fractional version", "version", options({ version: 1.5 })],
    ["a blank title", "title", options({ title: " " })],
    ["no steps", "steps", options({ steps: [] })],
    ["a blank step id", "steps[0].id", withStep({ id: "" })],
    ["a blank step title", "steps[0].title", withStep({ title: "" })],
    ["an image without src", "steps[0].image.src", withStep({ image: { src: "", alt: "" } })],
    ["an empty selector list", "steps[0].target", withStep({ target: [] })],
    ["a blank selector", "steps[0].target[1]", withStep({ target: ["jolly-dock", " "] })],
    ["an unknown side", "steps[0].side", withStep({ side: "top" as "above" })],
    ["a follow-up that is not a tour", "followUp", options({ followUp: "next" as unknown as Tour })],
    [
      "a repeated step id",
      "steps[1].id",
      options({ steps: [step("welcome"), step("welcome")] })
    ]
  ];
  for (const [label, field, definition] of broken) {
    test(`names the field for ${label}`, () => {
      assert.throws(
        () => new Tour(definition),
        (error) => error instanceof TourDefinitionError && error.field === field
      );
    });
  }
});
