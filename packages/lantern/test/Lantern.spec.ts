// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { once } from "@openally/emitt";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  Lantern,
  UnknownTourError,
  type TourRun
} from "#src/index.ts";
import {
  step,
  tour
} from "./helpers/tours.ts";

interface Page {
  lantern: Lantern;
  presented: TourRun[];
  changes: number;
}

function page(
  options: { autoStart?: boolean; } = {}
): Page {
  const presented: TourRun[] = [];
  const result: Page = {
    lantern: new Lantern({
      storage: new MemoryStorageAdapter(),
      present: (run) => presented.push(run),
      autoStart: options.autoStart
    }),
    presented,
    changes: 0
  };
  result.lantern.on("change", () => {
    result.changes++;
  });

  return result;
}

const basics = tour([step("welcome")], { id: "editor.basics" });
const brushes = tour([step("brush")], { id: "editor.brushes" });

describe("Lantern", () => {
  test("lists registered tours in registration order", () => {
    const { lantern } = page();
    lantern.register(brushes);
    lantern.register(basics);

    assert.deepEqual([...lantern].map(({ id }) => id), ["editor.brushes", "editor.basics"]);
  });

  test("emits change on register and release", () => {
    const context = page();
    const release = context.lantern.register(basics);
    release();

    assert.equal(context.changes, 2);
    assert.throws(() => context.lantern.tour("editor.basics"), UnknownTourError);
  });

  test("keeps a newer registration when the older one is released", () => {
    const { lantern } = page();
    const replaced = tour([step("other")], { id: "editor.basics" });
    const release = lantern.register(basics);
    lantern.register(replaced);
    release();

    assert.equal(lantern.tour("editor.basics"), replaced);
  });

  test("starts a tour and presents its run", () => {
    const { lantern, presented } = page();
    const run = lantern.start(basics);

    assert.deepEqual(presented, [run]);
    assert.equal(lantern.current, run);
  });

  test("records the tour once it is finished or skipped", async() => {
    const { lantern } = page();
    const finished = lantern.start(basics);
    await finished.next();

    const skipped = lantern.start(brushes);
    skipped.skip();
    await once(skipped, "end");

    assert.equal(lantern.seen.has(basics), true);
    assert.equal(lantern.seen.has(brushes), true);
    assert.equal(lantern.current, null);
  });

  test("offers a registered tour that was never seen", async() => {
    const { lantern } = page();
    lantern.register(basics);
    const run = lantern.offer(basics);
    assert.equal(run?.tour, basics);

    run.skip();
    await once(run, "end");

    assert.equal(lantern.offer(basics), null);
  });

  test("offers nothing while a tour runs, for an unregistered tour, or without autoStart", () => {
    const running = page();
    running.lantern.register(basics);
    running.lantern.register(brushes);
    running.lantern.start(brushes);

    const disabled = page({ autoStart: false });
    disabled.lantern.register(basics);

    assert.equal(running.lantern.offer(basics), null);
    assert.equal(page().lantern.offer(basics), null);
    assert.equal(disabled.lantern.offer(basics), null);
  });

  test("starts the follow-up once the tour finishes into it", async() => {
    const { lantern, presented } = page();
    const intro = tour([step("welcome")], {
      id: "editor.intro",
      followUp: brushes
    });
    const run = lantern.start(intro);
    await run.startFollowUp();

    assert.equal(lantern.seen.has(intro), true);
    assert.equal(lantern.current?.tour, brushes);
    assert.equal(presented.length, 2);
  });

  test("interrupts the running tour without recording it when another starts", async() => {
    const { lantern } = page();
    const first = lantern.start(basics);
    lantern.start(brushes);
    const [outcome] = await once(first, "end");

    assert.equal(outcome, "interrupted");
    assert.equal(lantern.seen.has(basics), false);
    assert.equal(lantern.current?.tour, brushes);
  });

  test("interrupts the running tour without recording it when it is released", async() => {
    const { lantern } = page();
    const release = lantern.register(basics);
    const run = lantern.start(basics);
    release();
    const [outcome] = await once(run, "end");

    assert.equal(outcome, "interrupted");
    assert.equal(lantern.current, null);
    assert.equal(lantern.seen.has(basics), false);
  });

  test("forgets a run interrupted from outside and offers tours again", async() => {
    const { lantern } = page();
    lantern.register(basics);
    lantern.register(brushes);
    const run = lantern.start(basics);
    run.interrupt();
    await once(run, "end");

    assert.equal(lantern.current, null);
    assert.equal(lantern.seen.has(basics), false);
    assert.equal(lantern.offer(brushes)?.tour, brushes);
  });

  test("records a tour skipped right before another starts and keeps the new one current", async() => {
    const { lantern } = page();
    const skipped = lantern.start(basics);
    skipped.skip();
    lantern.start(brushes);
    await once(skipped, "end");

    assert.equal(lantern.seen.has(basics), true);
    assert.equal(lantern.current?.tour, brushes);
  });
});
