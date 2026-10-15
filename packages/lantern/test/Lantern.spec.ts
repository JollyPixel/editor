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
  type LanternSession
} from "#src/index.ts";
import {
  step,
  tour
} from "./helpers/tours.ts";

interface Page {
  lantern: Lantern;
  presented: LanternSession[];
  changes: number;
}

function page(
  options: { autoStart?: boolean; } = {}
): Page {
  const presented: LanternSession[] = [];
  const result: Page = {
    lantern: new Lantern({
      storage: new MemoryStorageAdapter(),
      present: (session) => presented.push(session),
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

  test("starts a tour and presents its session", () => {
    const { lantern, presented } = page();
    const session = lantern.start(basics);

    assert.deepEqual(presented, [session]);
    assert.equal(lantern.session, session);
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
    assert.equal(lantern.session, null);
  });

  test("offers a registered tour that was never seen", async() => {
    const { lantern } = page();
    lantern.register(basics);
    const session = lantern.offer(basics);
    assert.equal(session?.tour, basics);

    session.skip();
    await once(session, "end");

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
    const session = lantern.start(intro);
    await session.startFollowUp();

    assert.equal(lantern.seen.has(intro), true);
    assert.equal(lantern.session?.tour, brushes);
    assert.equal(presented.length, 2);
  });

  test("skips the running tour without recording it when another starts", async() => {
    const { lantern } = page();
    const first = lantern.start(basics);
    lantern.start(brushes);
    await once(first, "end");

    assert.equal(first.state, "skipped");
    assert.equal(lantern.seen.has(basics), false);
    assert.equal(lantern.session?.tour, brushes);
  });

  test("skips the running tour without recording it when it is released", async() => {
    const { lantern } = page();
    const release = lantern.register(basics);
    const session = lantern.start(basics);
    release();
    await once(session, "end");

    assert.equal(lantern.session, null);
    assert.equal(lantern.seen.has(basics), false);
  });
});
