// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";

// Import Internal Dependencies
import {
  LanternSession,
  UnknownStepError,
  type SessionOutcome,
  type StepContext,
  type Tour
} from "#src/index.ts";
import {
  step,
  tour
} from "../helpers/tours.ts";

interface Recorder {
  session: LanternSession;
  log: string[];
  warnings: string[];
}

function record(
  session: LanternSession,
  log: string[] = []
): Omit<Recorder, "warnings"> {
  session.on("step", (shown) => log.push(`step ${shown.id}`));
  session.on("end", (outcome) => log.push(`end ${outcome}`));

  return {
    session,
    log
  };
}

function start(
  steps = tour(),
  at?: string
): Recorder {
  const warnings: string[] = [];
  const recorder = record(new LanternSession(steps, {
    at,
    warn: (message) => warnings.push(message)
  }));

  return {
    ...recorder,
    warnings
  };
}

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

describe("LanternSession", () => {
  test("shows the first step", async() => {
    const { session, log } = start();
    await once(session, "step");

    assert.equal(session.step.id, "one");
    assert.deepEqual(log, ["step one"]);
  });

  test("starts at the step named by at", async() => {
    const { session } = start(tour(), "two");
    await once(session, "step");

    assert.equal(session.index, 1);
  });

  test("throws on an unknown starting step", () => {
    assert.throws(() => new LanternSession(tour(), { at: "missing" }), UnknownStepError);
  });

  test("finishes after next on the last step", async() => {
    const { session, log } = start();
    await session.next();
    await session.next();
    await session.next();

    assert.equal(session.state, "finished");
    assert.deepEqual(log, ["step one", "step two", "step three", "end finished"]);
  });

  test("finishes into its follow-up only from the last step", async() => {
    const followUp = tour([step("next")], { id: "test.next" });
    const session = new LanternSession(tour([step("one"), step("two")], { followUp }));
    const ends: Array<[SessionOutcome, Tour | null]> = [];
    session.on("end", (outcome, chosen) => ends.push([outcome, chosen]));
    await session.startFollowUp();
    assert.equal(session.index, 0);

    await session.next();
    await session.startFollowUp();

    assert.equal(session.state, "finished");
    assert.deepEqual(ends, [["finished", followUp]]);
  });

  test("offers no follow-up on a last step that waits for an action", async() => {
    const followUp = tour([step("next")], { id: "test.next" });
    const pending = Promise.withResolvers<void>();
    const session = new LanternSession(tour([
      step("place", { until: () => pending.promise })
    ], { followUp }));
    await session.startFollowUp();

    assert.equal(session.offeredFollowUp, null);
    assert.equal(session.state, "running");
    session.skip();
  });

  test("ignores back on the first step", async() => {
    const { session, log } = start();
    await session.back();

    assert.equal(session.index, 0);
    assert.deepEqual(log, ["step one"]);
  });

  test("runs the cleanup of the step it leaves before entering the next", async() => {
    const log: string[] = [];
    const steps = tour([tracked("one", log), tracked("two", log)]);
    const { session } = record(new LanternSession(steps), log);
    await session.next();
    await session.back();
    await session.next();
    await session.next();

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
    const { session } = record(new LanternSession(tour([tracked("one", log)])), log);
    await once(session, "step");
    session.skip();
    await once(session, "end");

    assert.equal(session.state, "skipped");
    assert.deepEqual(log, ["enter one", "step one", "cleanup one", "end skipped"]);
  });

  test("queues calls made while enter is pending", async() => {
    const pending = Promise.withResolvers<void>();
    const { session, log } = start(tour([
      step("one", { enter: () => pending.promise }),
      step("two"),
      step("three")
    ]));
    const first = session.next();
    const second = session.next();
    pending.resolve();
    await Promise.all([first, second]);

    assert.equal(session.step.id, "three");
    assert.deepEqual(log, ["step one", "step two", "step three"]);
  });

  test("aborts a pending enter on skip and still runs its late cleanup", async() => {
    const pending = Promise.withResolvers<() => void>();
    const entered = Promise.withResolvers<AbortSignal>();
    let cleaned = false;
    const { session, log } = start(tour([
      step("one", {
        enter: (context) => {
          entered.resolve(context.signal);

          return pending.promise;
        }
      })
    ]));
    const signal = await entered.promise;
    session.skip();
    assert.equal(signal.aborted, true);

    pending.resolve(() => {
      cleaned = true;
    });
    await once(session, "end");

    assert.equal(cleaned, true);
    assert.deepEqual(log, ["end skipped"]);
  });

  test("does not enter the first step when skipped right after creation", async() => {
    const log: string[] = [];
    const { session } = record(new LanternSession(tour([tracked("one", log)])), log);
    session.skip();
    await once(session, "end");

    assert.deepEqual(log, ["end skipped"]);
  });

  test("warns and still shows a step whose enter throws", async() => {
    const { session, warnings } = start(tour([
      step("one", {
        enter: () => {
          throw new Error("no dock");
        }
      })
    ]));
    await once(session, "step");

    assert.match(warnings[0], /"test\.tour" step "one": enter failed, no dock/);
  });

  describe("interactive steps", () => {
    function interactive(
      until: (context: StepContext) => Promise<void>
    ): Recorder {
      return start(tour([step("place", { until }), step("done")]));
    }

    test("advance when until resolves", async() => {
      const pending = Promise.withResolvers<void>();
      const { session } = interactive(() => pending.promise);
      await once(session, "step");
      pending.resolve();
      await once(session, "step");

      assert.equal(session.step.id, "done");
    });

    test("warn and advance when until rejects", async() => {
      const { session, warnings } = interactive(() => Promise.reject(new Error("lost")));
      await once(session, "step");
      await once(session, "step");

      assert.equal(session.step.id, "done");
      assert.match(warnings[0], /until failed, lost/);
    });

    test("abort until when the step is left and ignore its late result", async() => {
      const pending = Promise.withResolvers<void>();
      let signal: AbortSignal | null = null;
      const outcomes: SessionOutcome[] = [];
      const { session } = interactive((context) => {
        signal = context.signal;

        return pending.promise;
      });
      session.on("end", (outcome) => outcomes.push(outcome));
      await once(session, "step");
      session.skip();
      pending.resolve();
      await once(session, "end");

      assert.equal(signal!.aborted, true);
      assert.equal(session.step.id, "place");
      assert.deepEqual(outcomes, ["skipped"]);
    });
  });
});
