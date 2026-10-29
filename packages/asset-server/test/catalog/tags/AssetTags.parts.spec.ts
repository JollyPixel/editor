// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { AssetTags } from "#src/index.ts";
import {
  syncHarness,
  type SyncHarness
} from "../../helpers/backend.ts";
import {
  tileHandler,
  TILE_CHANGED,
  type TileCommand,
  type TileState
} from "../../helpers/kinds.ts";
import { text } from "../../helpers/bytes.ts";
import { readBackups } from "../../helpers/backups.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface TilesTagHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly tags: AssetTags;
  readonly assetId: string;
  change(command: TileCommand): Promise<void>;
  tiles(): Promise<Record<string, string>>;
}

async function tilesTagHarness(): Promise<TilesTagHarness> {
  const sync = await syncHarness({
    handlers: [tileHandler()]
  });
  const { assetId } = (await sync.writer.create({
    path: "w.tiles",
    actor: kActor
  })).unwrap();
  await sync.flush();
  await sync.states.acquire(assetId, "tiles");
  const tags = new AssetTags({
    eventStore: sync.eventStore,
    projector: sync.projector,
    writer: sync.writer,
    flush: (id) => sync.flush(id),
    backups: sync.backups,
    kinds: sync.kinds
  });

  return {
    sync,
    tags,
    assetId,
    async change(command) {
      (await sync.eventStore.writer.append({
        assetType: "tiles",
        assetId,
        eventType: TILE_CHANGED,
        eventData: command,
        actor: kActor
      })).unwrap();
      await sync.scheduler.snapshot(assetId);
    },
    async tiles() {
      sync.states.release(assetId);
      const entry = await sync.states.acquire(assetId, "tiles");

      return Object.fromEntries((entry.state as TileState).tiles);
    },
    async [Symbol.asyncDispose]() {
      await sync[Symbol.asyncDispose]();
    }
  };
}

describe("AssetTags — parts", () => {
  test("read returns every tagged part", async() => {
    await using harness = await tilesTagHarness();
    await harness.change({ action: "paint", tile: "b", value: "sand" });
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();

    const tagged = (await harness.tags.read(harness.assetId, "v1")).unwrap();

    assert.deepEqual(
      Object.fromEntries([...tagged.parts ?? []].map(([id, data]) => [id, text(data)])),
      { a: "grass", b: "sand" }
    );
  });

  test("a tag backs up each part at its part file path", async() => {
    await using harness = await tilesTagHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();

    assert.deepEqual(
      (await readBackups(harness.sync.source)).map(({ path }) => path),
      ["w.tiles", "w.tiles.parts/a.tile"]
    );
  });

  test("restore brings back the tagged parts and drops newer ones", async() => {
    await using harness = await tilesTagHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();
    await harness.change({ action: "paint", tile: "b", value: "sand" });

    const report = (await harness.tags.restore({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();

    assert.strictEqual(report.restored, true);
    assert.deepEqual(await harness.tiles(), { a: "grass" });
    assert.deepEqual(await harness.sync.source.list(), [
      "w.tiles",
      "w.tiles.parts/a.tile"
    ]);
  });

  test("restores a tag whose manifest matches but whose parts differ", async() => {
    await using harness = await tilesTagHarness();
    (await harness.tags.create({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();
    await harness.change({ action: "paint", tile: "a", value: "lava" });

    const report = (await harness.tags.restore({
      assetId: harness.assetId,
      name: "v1",
      actor: kActor
    })).unwrap();

    assert.strictEqual(report.restored, true);
    assert.deepEqual(await harness.tiles(), { a: "grass" });
  });
});
