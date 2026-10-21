// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";
import type { AnchorRect } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  TargetFrame,
  TourStepOptions
} from "#src/index.ts";
import { TourRun } from "#src/tour/TourRun.ts";
import {
  step,
  tour
} from "../helpers/tours.ts";

interface Seeking {
  run: TourRun;
  warnings: string[];
}

async function seeking(
  ...targets: Array<TourStepOptions["target"]>
): Promise<Seeking> {
  const warnings: string[] = [];
  const run = new TourRun(tour(targets.map(
    (target, index) => step(`step-${index}`, { target })
  )), {
    warn: (message) => warnings.push(message)
  });
  await once(run, "step");

  return {
    run,
    warnings
  };
}

function seek(
  run: TourRun,
  now: number
): TargetFrame<Element | AnchorRect>["kind"] {
  return run.seek(now, (found) => found).kind;
}

describe("TourRun target seeking", () => {
  test("anchors a selector target found in the page", async() => {
    const element = document.createElement("div");
    element.id = "lantern-target";
    document.body.append(element);
    const { run } = await seeking(["#lantern-target"]);
    const frame = run.seek(0, (found) => found);
    element.remove();

    assert.deepEqual(frame, {
      kind: "anchored",
      anchor: element
    });
  });

  test("seeks a missing target for one second, then centres the card and warns once", async() => {
    const { run, warnings } = await seeking(["#missing"]);

    assert.deepEqual(
      [100, 1099, 1100, 1600].map((now) => seek(run, now)),
      ["seeking", "seeking", "centred", "centred"]
    );
    assert.deepEqual(warnings, [
      "Tour \"test.tour\" step \"step-0\": no target found for \"#missing\", the card is centred"
    ]);
  });

  test("lights a target that shows up after the card was centred", async() => {
    let rect: AnchorRect | null = null;
    const { run } = await seeking(() => rect);
    seek(run, 0);
    seek(run, 1000);
    rect = {
      top: 0,
      left: 0,
      bottom: 10,
      right: 10
    };

    assert.equal(seek(run, 2000), "anchored");
  });

  test("centres the card and warns when the target function throws", async() => {
    const { run, warnings } = await seeking(() => {
      throw new Error("no viewport");
    });

    assert.equal(seek(run, 0), "centred");
    assert.match(warnings[0], /step "step-0": target failed, Error: no viewport/);
  });

  test("seeks again on the next step after giving up", async() => {
    const { run } = await seeking(["#missing"], ["#missing"]);
    seek(run, 0);
    seek(run, 1000);
    await run.next();

    assert.equal(seek(run, 5000), "seeking");
  });

  test("centres the card at once for a step without a target", async() => {
    const { run, warnings } = await seeking(undefined);

    assert.equal(seek(run, 0), "centred");
    assert.deepEqual(warnings, []);
  });
});
