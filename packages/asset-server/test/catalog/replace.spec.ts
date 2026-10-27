// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import type { ServerOptions } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_REPLACE,
  CATALOG_ROOM,
  createAssetBackend,
  type AssetKindHandler
} from "#src/index.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import {
  connectCatalog,
  type CatalogConnection
} from "../helpers/catalog.ts";
import { counterHandler } from "../helpers/kinds.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kPath = "scores/total.counter";

interface ReplaceProject extends AsyncDisposable {
  readonly connection: CatalogConnection;
  readonly assetId: string;
  read(): Promise<string>;
}

function tallyCounter(): AssetKindHandler {
  return {
    ...counterHandler(),
    conversions: {
      ".tally": async(content) => bytes(String(text(content).length))
    }
  };
}

async function replaceProject(
  options: ServerOptions = {}
): Promise<ReplaceProject> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source,
    eventStore,
    handlers: [tallyCounter()],
    reconcile: {
      watch: false
    }
  });
  const { assetId } = (await backend.writer.create({
    path: kPath,
    data: bytes("1"),
    actor: kActor
  })).unwrap();
  await backend.flush();
  const connection = await connectCatalog(backend, options);

  return {
    connection,
    assetId,
    async read() {
      return text(await source.read(kPath));
    },
    async [Symbol.asyncDispose]() {
      await connection[Symbol.asyncDispose]();
      await backend.close();
      eventStore.close();
    }
  };
}

describe("catalog:replace over loopback", () => {
  test("new content keeps the asset's ID and path, and its restore point brings the old back", async() => {
    await using project = await replaceProject();
    const { catalog } = project.connection;
    const { assetId } = project;

    const report = await catalog.replace(assetId, bytes("7"));

    assert.strictEqual(report.replaced, true);
    assert.strictEqual(await project.read(), "7");
    assert.deepEqual([...catalog.records()].map(({ id, path }) => [id, path]), [[assetId, kPath]]);
    const restorePoint = report.restorePoint?.name ?? "";
    assert.match(restorePoint, /^restore\/\d+$/);

    await catalog.restore(assetId, restorePoint);

    assert.strictEqual(await project.read(), "1");
  });

  test("the asset's kind converts content of another format", async() => {
    await using project = await replaceProject();

    await project.connection.catalog.replace(project.assetId, bytes("|||"), { from: ".tally" });

    assert.strictEqual(await project.read(), "3");
  });

  test("the same content leaves the asset and its tags alone", async() => {
    await using project = await replaceProject();
    const { catalog } = project.connection;

    const report = await catalog.replace(project.assetId, bytes("1"));

    assert.deepEqual(report, { replaced: false });
    assert.deepEqual(await catalog.tags(project.assetId), []);
  });

  test("an unknown asset is rejected with the reason", async() => {
    await using project = await replaceProject();

    await assert.rejects(
      project.connection.catalog.replace("no-such-asset", bytes("2")),
      /no-such-asset/
    );
  });

  test("a role without the replace right leaves the content alone", async() => {
    await using project = await replaceProject({
      rights: {
        default: {
          [`${CATALOG_ROOM}.${CATALOG_REPLACE}`]: "read",
          "*": "write"
        }
      }
    });
    const { catalog } = project.connection;

    void catalog.replace(project.assetId, bytes("9")).catch(() => void 0);
    const tags = await catalog.tags(project.assetId);

    assert.deepEqual(tags, []);
    assert.strictEqual(await project.read(), "1");
  });
});
