// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";

// Import Internal Dependencies
import {
  UnknownStepError,
  type RunOutcome,
  type Tour
} from "#src/index.ts";
import { TourRun } from "#src/tour/TourRun.ts";
import {
  step,
  tour
} from "../helpers/tours.ts";
import {
  record,
  start
} from "../helpers/runs.ts";

function tracked(
  id: string,
  log: string[]
) {
  return step(id, {
    enter: () => {
      log.push(`enter ${id}`);

      return () => log.push(`cleanup ${id}`);
    }
  });
}

describe("TourRun", () => {
  test("shows the first step", async() => {
    const { run, log } = start();
    await once(run, "step");

    assert.equal(run.step.id, "one");
    assert.deepEqual(log, ["step one"]);
  });

  test("starts at the step named by at", async() => {
    const { run } = start(tour(), "two");
    await once(run, "step");

    assert.equal(run.index, 1);
  });

  test("throws on an unknown starting step", () => {
    assert.throws(() => new TourRun(tour(), { at: "missing" }), UnknownStepError);
  });

  test("finishes after next on the last step", async() => {
    const { run, log } = start();
    await run.next();
    await run.next();
    await run.next();

    assert.equal(run.state, "finished");
    assert.deepEqual(log, ["step one", "step two", "step three", "end finished"]);
  });

  test("finishes into its follow-up only from the last step", async() => {
    const followUp = tour([step("next")], { id: "test.next" });
    const run = new TourRun(tour([step("one"), step("two")], { followUp }));
    const ends: Array<[RunOutcome, Tour | null]> = [];
    run.on("end", (outcome, chosen) => ends.push([outcome, chosen]));
    await run.startFollowUp();
    assert.equal(run.index, 0);

    await run.next();
    await run.startFollowUp();

    assert.equal(run.state, "finished");
    assert.deepEqual(ends, [["finished", followUp]]);
  });

  test("offers no follow-up on a last step that waits for an action", async() => {
    const followUp = tour([step("next")], { id: "test.next" });
    const pending = Promise.withResolvers<void>();
    const run = new TourRun(tour([
      step("place", { until: () => pending.promise })
    ], { followUp }));
    await run.startFollowUp();

    assert.equal(run.offeredFollowUp, null);
    assert.equal(run.state, "running");
    run.skip();
  });

  test("ignores back on the first step", async() => {
    const { run, log } = start();
    await run.back();

    assert.equal(run.index, 0);
    assert.deepEqual(log, ["step one"]);
  });

  test("runs the cleanup of the step it leaves before entering the next", async() => {
    const log: string[] = [];
    const steps = tour([tracked("one", log), tracked("two", log)]);
    const { run } = record(new TourRun(steps), log);
    await run.next();
    await run.back();
    await run.next();
    await run.next();

    assert.deepEqual(log, [
      "enter one", "step one",
      "cleanup one", "enter two", "step two",
      "cleanup two", "enter one", "step one",
      "cleanup one", "enter two", "step two",
      "cleanup two", "end finished"
    ]);
  });

  test("runs the cleanup when the tour is skipped", async() => {
    const log: string[] = [];
    const { run } = record(new TourRun(tour([tracked("one", log)])), log);
    await once(run, "step");
    run.skip();
    await once(run, "end");

    assert.equal(run.state, "skipped");
    assert.deepEqual(log, ["enter one", "step one", "cleanup one", "end skipped"]);
  });

  test("queues calls made while enter is pending", async() => {
    const pending = Promise.withResolvers<void>();
    const { run, log } = start(tour([
      step("one", { enter: () => pending.promise }),
      step("two"),
      step("three")
    ]));
    const first = run.next();
    const second = run.next();
    pending.resolve();
    await Promise.all([first, second]);

    assert.equal(run.step.id, "three");
    assert.deepEqual(log, ["step one", "step two", "step three"]);
  });

  test("aborts a pending enter on skip and still runs its late cleanup", async() => {
    const pending = Promise.withResolvers<() => void>();
    const entered = Promise.withResolvers<AbortSignal>();
    let cleaned = false;
    const { run, log } = start(tour([
      step("one", {
        enter: (context) => {
          entered.resolve(context.signal);

          return pending.promise;
        }
      })
    ]));
    const signal = await entered.promise;
    run.skip();
    assert.equal(signal.aborted, true);

    pending.resolve(() => {
      cleaned = true;
    });
    await once(run, "end");

    assert.equal(cleaned, true);
    assert.deepEqual(log, ["end skipped"]);
  });

  test("does not enter the first step when skipped right after creation", async() => {
    const log: string[] = [];
    const { run } = record(new TourRun(tour([tracked("one", log)])), log);
    run.skip();
    await once(run, "end");

    assert.deepEqual(log, ["end skipped"]);
  });

  test("warns and still shows a step whose enter throws", async() => {
    const { run, warnings } = start(tour([
      step("one", {
        enter: () => {
          throw new Error("no dock");
        }
      })
    ]));
    await once(run, "step");

    assert.match(warnings[0], /"test\.tour" step "one": enter failed, no dock/);
  });
});
