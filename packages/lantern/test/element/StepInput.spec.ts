// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { StepInput } from "#src/element/StepInput.ts";
import { TourRun } from "#src/tour/TourRun.ts";
import {
  step,
  tour
} from "../helpers/tours.ts";

// CONSTANTS
const kInputs = new Set<StepInput>();

function controllerHost() {
  return Object.assign(document.createElement("div"), {
    addController: () => undefined,
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  });
}

async function follow(
  run: TourRun
): Promise<StepInput> {
  await once(run, "step");
  const input = new StepInput(controllerHost());
  kInputs.add(input);
  input.follow(run);

  return input;
}

function keydown(
  key: string,
  init: KeyboardEventInit = {}
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init
  });
}

async function press(
  event: KeyboardEvent,
  target: EventTarget = window
): Promise<void> {
  target.dispatchEvent(event);
  await setImmediate();
}

function position(
  run: TourRun
): string {
  return run.state === "running" ? run.step.id : run.state;
}

describe("StepInput", () => {
  afterEach(() => {
    for (const input of kInputs) {
      input.release();
    }
    kInputs.clear();
  });

  const keys: Array<[string, string]> = [
    ["ArrowRight", "three"],
    ["Enter", "three"],
    ["ArrowLeft", "one"],
    ["Escape", "skipped"]
  ];
  for (const [key, expected] of keys) {
    test(`moves a passive step with ${key}`, async() => {
      const run = new TourRun(tour(), { at: "two" });
      await follow(run);
      await press(keydown(key));

      assert.equal(position(run), expected);
    });
  }

  test("ignores keys held with a modifier", async() => {
    const run = new TourRun(tour(), { at: "two" });
    await follow(run);
    for (const modifier of ["ctrlKey", "metaKey", "altKey"]) {
      await press(keydown("ArrowRight", { [modifier]: true }));
    }

    assert.equal(position(run), "two");
  });

  test("ignores a key pressed before the step took the keyboard", async() => {
    const run = new TourRun(tour());
    const opening = keydown("Enter");
    await follow(run);
    await press(opening);

    assert.equal(position(run), "one");
  });

  test("leaves Enter to the button it was pressed on", async() => {
    const run = new TourRun(tour());
    const button = document.createElement("button");
    document.body.append(button);
    await follow(run);
    await press(keydown("Enter"), button);
    button.remove();

    assert.equal(position(run), "one");
  });

  test("frees the keyboard on an interactive step and takes it back on the next passive one", async() => {
    const placed = Promise.withResolvers<void>();
    const run = new TourRun(tour([
      step("place", { until: () => placed.promise }),
      step("done")
    ]));
    const input = await follow(run);
    await press(keydown("Escape"));

    assert.equal(inputLayers.open, false);
    assert.equal(position(run), "place");

    placed.resolve();
    await once(run, "step");
    input.follow(run);

    assert.equal(inputLayers.open, true);
  });

  test("skips the run when its input layer is dismissed", async() => {
    const run = new TourRun(tour());
    await follow(run);
    inputLayers.dismissAll();

    assert.equal(run.state, "skipped");
  });
});
