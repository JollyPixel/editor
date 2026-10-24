// Import Node.js Dependencies
import { describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";

// Import Internal Dependencies
import type { StepContext } from "#src/index.ts";
import {
  step,
  tour
} from "../helpers/tours.ts";
import {
  start,
  type Recorder
} from "../helpers/runs.ts";

describe("TourRun step hooks", () => {
  describe("conditional steps", () => {
    test("skip the steps whose when is false and leave them out of the count", async() => {
      const { run, log } = start(tour([
        step("one"),
        step("two", { when: () => false }),
        step("three"),
        step("four", { when: () => false })
      ]));
      await once(run, "step");
      assert.deepEqual([run.position, run.count, run.last], [1, 2, false]);

      await run.next();
      assert.deepEqual([run.position, run.count, run.first, run.last], [2, 2, false, true]);

      await run.back();
      await run.next();
      await run.next();

      assert.deepEqual(log, ["step one", "step three", "step one", "step three", "end finished"]);
    });

    test("check when again on every move", async() => {
      let ready = false;
      const { run } = start(tour([
        step("one"),
        step("two", { when: () => ready }),
        step("three")
      ]));
      await once(run, "step");
      ready = true;
      await run.next();

      assert.equal(run.step.id, "two");
    });

    test("warn and show a step whose when throws", async() => {
      const { run, warnings } = start(tour([
        step("one", {
          when: () => {
            throw new Error("no map");
          }
        })
      ]));
      await once(run, "step");

      assert.equal(run.step.id, "one");
      assert.match(warnings[0], /"test\.tour" step "one": when failed, no map/);
    });
  });

  describe("interactive steps", () => {
    function interactive(
      until: (context: StepContext) => Promise<void>
    ): Recorder {
      return start(tour([step("place", { until }), step("done")]));
    }

    test("advance when until resolves", async() => {
      const pending = Promise.withResolvers<void>();
      const { run } = interactive(() => pending.promise);
      await once(run, "step");
      pending.resolve();
      await once(run, "step");

      assert.equal(run.step.id, "done");
    });

    test("warn and advance when until rejects", async() => {
      const { run, warnings } = interactive(() => Promise.reject(new Error("lost")));
      await once(run, "step");
      await once(run, "step");

      assert.equal(run.step.id, "done");
      assert.match(warnings[0], /until failed, lost/);
    });

    test("abort until when the step is left and ignore its late result", async() => {
      const pending = Promise.withResolvers<void>();
      let signal: AbortSignal | null = null;
      const { run, warnings } = start(tour([
        step("intro"),
        step("place", {
          until: (context) => {
            signal = context.signal;

            return pending.promise;
          }
        }),
        step("done")
      ]), "place");
      await once(run, "step");
      await run.back();
      pending.reject(new Error("lost"));
      await setImmediate();

      assert.equal(signal!.aborted, true);
      assert.equal(run.step.id, "intro");
      assert.equal(run.state, "running");
      assert.deepEqual(warnings, []);
    });
  });
});
