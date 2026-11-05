// Import Node.js Dependencies
import {
  afterEach,
  beforeEach,
  describe,
  mock,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { NotificationQueue } from "../../src/feedback/NotificationQueue.ts";

function readTitles(
  queue: NotificationQueue
): string[] {
  return queue.entries.map((entry) => entry.title);
}

describe("NotificationQueue", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout", "Date"] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  test("closes each tone after its default duration", () => {
    const queue = new NotificationQueue();
    queue.notify({ tone: "success", title: "saved" });
    queue.notify({ tone: "info", title: "hint" });
    queue.notify({ tone: "warning", title: "slow" });
    queue.notify({ tone: "error", title: "failed" });
    queue.notify({ tone: "loading", title: "uploading" });

    mock.timers.tick(4_000);
    assert.deepEqual(readTitles(queue), ["uploading", "failed", "slow", "hint"]);
    mock.timers.tick(1_000);
    assert.deepEqual(readTitles(queue), ["uploading", "failed", "slow"]);
    mock.timers.tick(3_000);
    assert.deepEqual(readTitles(queue), ["uploading", "failed"]);
    mock.timers.tick(60_000);
    assert.deepEqual(readTitles(queue), ["uploading", "failed"]);
  });

  test("honours a duration given to the queue or to one notification", () => {
    const queue = new NotificationQueue({
      durations: { error: 2_000 }
    });
    queue.notify({ tone: "error", title: "failed" });
    queue.notify({ tone: "success", title: "pinned", duration: null });

    mock.timers.tick(2_000);

    assert.deepEqual(readTitles(queue), ["pinned"]);
  });

  test("starts the new tone's timer when a loading notification settles", () => {
    const queue = new NotificationQueue();
    const upload = queue.notify({ tone: "loading", title: "Replacing" });
    mock.timers.tick(10_000);

    upload.update({ tone: "success", title: "Replaced" });
    mock.timers.tick(3_999);
    assert.deepEqual(readTitles(queue), ["Replaced"]);
    mock.timers.tick(1);
    assert.deepEqual(readTitles(queue), []);
  });

  test("keeps the running timer when only the text changes", () => {
    const queue = new NotificationQueue();
    const saved = queue.notify({ tone: "success", title: "Saved" });
    mock.timers.tick(3_000);

    saved.update({ message: "2 assets" });
    mock.timers.tick(1_000);

    assert.deepEqual(readTitles(queue), []);
  });

  test("pauses the remaining time and resumes it", () => {
    const queue = new NotificationQueue();
    queue.notify({ tone: "success", title: "early" });
    mock.timers.tick(3_000);

    queue.pause();
    queue.notify({ tone: "success", title: "late" });
    mock.timers.tick(30_000);
    assert.deepEqual(readTitles(queue), ["late", "early"]);

    queue.resume();
    mock.timers.tick(1_000);
    assert.deepEqual(readTitles(queue), ["late"]);
    mock.timers.tick(3_000);
    assert.deepEqual(readTitles(queue), []);
  });

  test("evicts the oldest settled notification beyond the cap, never a loading one", () => {
    const queue = new NotificationQueue({ max: 2 });
    queue.notify({ tone: "loading", title: "upload" });
    queue.notify({ tone: "error", title: "first" });
    queue.notify({ tone: "error", title: "second" });
    assert.deepEqual(readTitles(queue), ["second", "upload"]);

    queue.notify({ tone: "loading", title: "download" });
    assert.deepEqual(readTitles(queue), ["download", "upload"]);
  });

  test("clamps progress to a fraction and drops non-finite values", () => {
    const queue = new NotificationQueue();
    const upload = queue.notify({
      tone: "loading",
      title: "upload",
      progress: 1.5
    });
    assert.equal(queue.entries[0].progress, 1);

    upload.update({ progress: -1 });
    assert.equal(queue.entries[0].progress, 0);

    upload.update({ progress: Number.NaN });
    assert.equal(queue.entries[0].progress, null);
  });

  test("ignores updates once a notification is dismissed", () => {
    const queue = new NotificationQueue();
    const upload = queue.notify({ tone: "loading", title: "upload" });
    const seen: string[][] = [];
    queue.subscribe((entries) => {
      seen.push(entries.map((entry) => entry.title));
    });

    upload.dismiss();
    upload.update({ tone: "success", title: "done" });

    assert.deepEqual(seen, [[]]);
    assert.deepEqual(readTitles(queue), []);
  });
});
