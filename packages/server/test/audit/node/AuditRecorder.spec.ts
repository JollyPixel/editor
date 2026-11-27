// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ASSET_CREATED } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  RECORDED_ASSET,
  recorderHarness,
  writeData
} from "../../helpers/auditRecorder.ts";

describe("AuditRecorder edit runs", () => {
  test("folds one actor's edits on one asset less than 5 minutes apart, around other actors", async(t) => {
    await using harness = await recorderHarness(t);
    await harness.lifecycle(ASSET_CREATED, writeData());
    await harness.edit("alice");
    await harness.at(1);
    await harness.edit("bob");
    await harness.at(2);
    await harness.edit("alice");
    await harness.edit("alice", "sky");
    await harness.at(8);
    await harness.edit("alice");

    assert.deepEqual(harness.edits(), [
      "alice map x1 8-8",
      "alice sky x1 2-2",
      "alice map x2 0-2",
      "bob map x1 1-1"
    ]);
  });

  test("keeps the versions around a run and summarizes them once it closes", async(t) => {
    await using harness = await recorderHarness(t);
    const created = await harness.lifecycle(ASSET_CREATED, writeData());
    await harness.edit("alice");
    await harness.snapshot();
    await harness.at(1);
    await harness.edit("alice");
    const second = await harness.snapshot();

    assert.deepEqual(harness.versions(), [{ from: created, to: second }]);
    assert.deepEqual(await harness.tagNames(), [`history/${created}`, `history/${second}`]);

    await harness.at(6);

    assert.deepEqual(harness.summaries, [[RECORDED_ASSET, `history/${created}`, `history/${second}`]]);
    const [run] = harness.rows("edits");
    assert.ok(run.type === "edits");
    assert.equal(run.summary, `history/${created} -> history/${second}`);
  });

  test("keeps a moved run end that another run starts from", async(t) => {
    await using harness = await recorderHarness(t);
    await harness.lifecycle(ASSET_CREATED, writeData());
    await harness.edit("alice");
    const shared = await harness.snapshot();
    await harness.edit("bob");
    await harness.edit("alice");
    const last = await harness.snapshot();

    assert.ok((await harness.tagNames()).includes(`history/${shared}`));
    assert.deepEqual(harness.versions().map(({ to }) => to), [last, last]);
  });

  test("writes the count of a run still open when it stops", async(t) => {
    await using harness = await recorderHarness(t);
    await harness.edit("alice");
    await harness.edit("alice");
    await harness.edit("alice");

    await harness.recorder[Symbol.asyncDispose]();

    assert.deepEqual(harness.edits(), ["alice map x3 0-0"]);
  });
});
