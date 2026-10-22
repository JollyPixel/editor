// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { unzipSync } from "fflate";

// Import Internal Dependencies
import {
  createAssetBackend,
  exportAssetArchive,
  importAssetArchive,
  readAssetArchive,
  type AssetBackend
} from "#src/index.ts";
import { ARCHIVE_ACTOR } from "../../helpers/archive.ts";
import { tileHandler } from "../../helpers/kinds.ts";
import { bytes, text } from "../../helpers/bytes.ts";

interface TilesProject extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly source: MemoryAssetSource;
  files(): Promise<Record<string, string>>;
}

async function tilesProject(): Promise<TilesProject> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source,
    eventStore,
    handlers: [tileHandler()],
    reconcile: {
      watch: false
    }
  });

  return {
    backend,
    source,
    async files() {
      const listed: Record<string, string> = {};
      for (const path of await source.list()) {
        listed[path] = text(await source.read(path));
      }

      return listed;
    },
    async [Symbol.asyncDispose]() {
      await backend.close();
      eventStore.close();
    }
  };
}

async function sandAndGrass(
  project: TilesProject
): Promise<string> {
  const { assetId } = (await project.backend.writer.create({
    path: "w.tiles",
    data: bytes("a,b"),
    parts: new Map([["a", bytes("grass")], ["b", bytes("sand")]]),
    actor: ARCHIVE_ACTOR
  })).unwrap();
  await project.backend.flush();

  return assetId;
}

describe("asset archives — parts", () => {
  test("a round trip carries the part files into another project", async() => {
    await using origin = await tilesProject();
    await using target = await tilesProject();
    await sandAndGrass(origin);

    const zipped = (await exportAssetArchive(origin.backend)).unwrap();
    const report = (await importAssetArchive(
      target.backend,
      readAssetArchive(zipped).unwrap(),
      { onConflict: "replace", actor: ARCHIVE_ACTOR }
    )).unwrap();

    assert.deepEqual(Object.keys(unzipSync(zipped)).sort(), [
      "bundle.json",
      "w.tiles",
      "w.tiles.parts/a.tile",
      "w.tiles.parts/b.tile"
    ]);
    assert.strictEqual(report.created.length, 1);
    assert.deepEqual(await target.files(), await origin.files());
  });

  test("a copy writes the parts beside the copied manifest", async() => {
    await using project = await tilesProject();
    await sandAndGrass(project);

    const archive = readAssetArchive(
      (await exportAssetArchive(project.backend)).unwrap()
    ).unwrap();
    (await importAssetArchive(project.backend, archive, {
      onConflict: "copy",
      actor: ARCHIVE_ACTOR
    })).unwrap();

    assert.deepEqual(await project.files(), {
      "w.tiles": "a,b",
      "w.tiles.parts/a.tile": "grass",
      "w.tiles.parts/b.tile": "sand",
      "w-2.tiles": "a,b",
      "w-2.tiles.parts/a.tile": "grass",
      "w-2.tiles.parts/b.tile": "sand"
    });
  });
});
