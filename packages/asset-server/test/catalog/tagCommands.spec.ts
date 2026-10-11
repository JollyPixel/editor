// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";
import { once } from "@openally/emitt";
import type { ServerOptions } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  CATALOG_RESTORE,
  CATALOG_ROOM,
  createAssetBackend,
  type AssetBackend
} from "#src/index.ts";
import { CatalogRejectedError } from "#src/catalog/client/index.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import {
  connectCatalog,
  type CatalogConnection
} from "../helpers/catalog.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kPath = "notes/todo.txt";

interface TagWorkspace extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly source: MemoryAssetSource;
  readonly connection: CatalogConnection;
  readonly assetId: string;
  write(content: string): Promise<void>;
  read(): Promise<string>;
}

async function tagWorkspace(
  options: ServerOptions = {}
): Promise<TagWorkspace> {
  const source = new MemoryAssetSource();
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source,
    eventStore,
    watch: false
  });
  const { assetId } = (await backend.writer.create({
    path: kPath,
    data: bytes("first"),
    actor: kActor
  })).unwrap();
  await backend.flush();
  const connection = await connectCatalog(backend, options);

  return {
    backend,
    source,
    connection,
    assetId,
    async write(content) {
      (await backend.writer.update({
        assetId,
        data: bytes(content),
        actor: kActor
      })).unwrap();
      await backend.flush(assetId);
    },
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

describe("catalog tag commands over loopback", () => {
  test("tag, restore and untag round trip through the client", async() => {
    await using workspace = await tagWorkspace();
    const { catalog } = workspace.connection;
    const { assetId } = workspace;

    const tag = await catalog.tag(assetId, "draft", "First pass");
    await workspace.write("second");
    const report = await catalog.restore(assetId, "draft");

    assert.strictEqual(tag.message, "First pass");
    assert.strictEqual(report.restored, true);
    assert.deepEqual(report.missing, []);
    assert.strictEqual(await workspace.read(), "first");
    const restorePoint = report.restorePoint?.name;
    assert.match(restorePoint ?? "", /^restore\/\d+$/);
    assert.deepEqual(
      (await catalog.tags(assetId)).map((entry) => entry.name),
      ["draft", restorePoint]
    );

    await catalog.untag(assetId, "draft");

    assert.deepEqual(
      (await catalog.tags(assetId)).map((entry) => entry.name),
      [restorePoint]
    );
  });

  test("unknown tags and assets are rejected with the reason", async() => {
    await using workspace = await tagWorkspace();
    const { catalog } = workspace.connection;

    await assert.rejects(
      catalog.untag(workspace.assetId, "missing"),
      (error: CatalogRejectedError) => {
        assert.ok(error instanceof CatalogRejectedError);
        assert.match(error.message, /no tag named "missing"/);

        return true;
      }
    );
    await assert.rejects(
      catalog.restore(workspace.assetId, "missing"),
      /no tag named "missing"/
    );
    await assert.rejects(
      catalog.tag("no-such-asset", "draft"),
      /no-such-asset/
    );
  });

  test("tag changes reach every member", async() => {
    await using workspace = await tagWorkspace();
    const { catalog } = workspace.connection;
    const member = await workspace.connection.join();
    const { assetId } = workspace;

    const tagged = once(member, "tags-changed");
    await catalog.tag(assetId, "draft");
    const [taggedId, afterTag] = await tagged;

    assert.strictEqual(taggedId, assetId);
    assert.deepEqual(afterTag.map((entry) => entry.name), ["draft"]);

    await workspace.write("second");
    const restored = once(member, "tags-changed");
    const report = await catalog.restore(assetId, "draft");
    const [, afterRestore] = await restored;

    assert.deepEqual(
      afterRestore.map((entry) => entry.name),
      ["draft", report.restorePoint?.name]
    );

    const untagged = once(member, "tags-changed");
    await catalog.untag(assetId, "draft");
    const [, afterUntag] = await untagged;

    assert.deepEqual(
      afterUntag.map((entry) => entry.name),
      [report.restorePoint?.name]
    );
  });

  test("a role without the restore right leaves the content alone", async() => {
    await using workspace = await tagWorkspace({
      rights: {
        default: {
          [`${CATALOG_ROOM}.${CATALOG_RESTORE}`]: "read",
          "*": "write"
        }
      }
    });
    const { catalog } = workspace.connection;
    const { assetId } = workspace;
    await catalog.tag(assetId, "draft");
    await workspace.write("second");

    void catalog.restore(assetId, "draft").catch(() => void 0);
    const tags = await catalog.tags(assetId);

    assert.deepEqual(tags.map((entry) => entry.name), ["draft"]);
    assert.strictEqual(await workspace.read(), "second");
  });
});
