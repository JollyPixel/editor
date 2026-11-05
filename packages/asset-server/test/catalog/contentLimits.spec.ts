// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  createAssetBackend,
  type AssetBackend
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

interface LimitedProject extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly connection: CatalogConnection;
  readonly source: MemoryAssetSource;
}

async function limitedProject(): Promise<LimitedProject> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source,
    eventStore,
    handlers: [
      {
        ...counterHandler(),
        maxContentBytes: 4,
        conversions: {
          ".tally": async(content) => {
            return {
              content: bytes(String(text(content).length))
            };
          }
        }
      }
    ],
    catalog: {
      maxContentBytes: 2
    },
    reconcile: {
      watch: false
    }
  });
  const connection = await connectCatalog(backend);

  return {
    backend,
    connection,
    source,
    async [Symbol.asyncDispose]() {
      await connection[Symbol.asyncDispose]();
      await backend.close();
      eventStore.close();
    }
  };
}

describe("catalog content limits", () => {
  test("a create meets its kind's maxContentBytes, above or below the catalog's", async() => {
    await using project = await limitedProject();
    const { catalog } = project.connection;

    await catalog.create("fits.counter", bytes("1234"));
    await assert.rejects(
      catalog.create("over.counter", bytes("12345")),
      /Content of 5 bytes exceeds the 4 bytes limit/
    );
    await assert.rejects(
      catalog.create("over.bin", bytes("123")),
      /Content of 3 bytes exceeds the 2 bytes limit/
    );
    await project.backend.flush();

    assert.deepEqual([...catalog.records()].map(({ path }) => path), ["fits.counter"]);
  });

  test("a replace meets its kind's maxContentBytes before conversion", async() => {
    await using project = await limitedProject();
    const { assetId } = (await project.backend.writer.create({
      path: "total.counter",
      data: bytes("1"),
      actor: kActor
    })).unwrap();
    await project.backend.flush();

    await assert.rejects(
      project.connection.catalog.replace(assetId, bytes("|||||"), { from: ".tally" }),
      /Content of 5 bytes exceeds the 4 bytes limit/
    );
    assert.strictEqual(text(await project.source.read("total.counter")), "1");
  });
});
