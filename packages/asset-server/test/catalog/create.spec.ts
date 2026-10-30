// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Server } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  BINARY_KIND,
  CATALOG_APPLIED,
  CATALOG_CREATE,
  CATALOG_REJECTED,
  CATALOG_ROOM,
  CatalogExtension,
  CatalogProjection,
  encodeContent,
  TEXTURE_KIND,
  textureAssetKind,
  type AssetKindHandler
} from "#src/index.ts";
import {
  catalogBackend,
  syncHarness,
  type SyncHarness
} from "../helpers/backend.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import {
  counterHandler,
  type CounterState
} from "../helpers/kinds.ts";
import { recordingClient } from "../helpers/rooms.ts";

interface CreateRequest {
  kind?: string;
  content?: Uint8Array;
  from?: string;
}

interface CreateReply {
  type?: string;
  reason?: string;
}

interface CatalogServer extends AsyncDisposable {
  readonly sync: SyncHarness;
  create(path: string, request?: CreateRequest): Promise<CreateReply>;
}

async function catalogServer(
  handlers: AssetKindHandler[] = []
): Promise<CatalogServer> {
  const sync = await syncHarness({ handlers });
  const projection = new CatalogProjection({
    projector: sync.projector
  });
  projection.load();
  projection.start();

  const server = new Server();
  server.register(new CatalogExtension({
    backend: catalogBackend(sync, projection)
  }));
  const author = recordingClient("A");
  const connectionA = server.connect(author, { subject: "A", role: "default" });
  await connectionA.receive({ room: CATALOG_ROOM, kind: "join" });

  let requests = 0;

  return {
    sync,
    async create(path, request = {}) {
      await connectionA.receive({
        room: CATALOG_ROOM,
        kind: "message",
        payload: JSON.parse(JSON.stringify({
          type: CATALOG_CREATE,
          requestId: `r${++requests}`,
          path,
          kind: request.kind,
          from: request.from,
          content: request.content === undefined ?
            undefined :
            encodeContent(request.content)
        }))
      });
      const reply = author.received.at(-1) as {
        payload?: CreateReply;
      };

      return reply.payload ?? {};
    },
    async [Symbol.asyncDispose]() {
      await server.close();
      projection.close();
      await sync[Symbol.asyncDispose]();
    }
  };
}

function tallyCounter(): AssetKindHandler {
  return {
    ...counterHandler(),
    conversions: {
      ".tally": async(content) => {
        const marks = text(content);
        if (!/^\|+$/.test(marks)) {
          throw new Error("not a tally");
        }

        return bytes(String(marks.length));
      }
    }
  };
}

describe("catalog:create without content", () => {
  test("writes the default state of each built-in kind", async() => {
    await using catalog = await catalogServer([textureAssetKind()]);

    assert.strictEqual(
      (await catalog.create("a.bin", { kind: BINARY_KIND })).type,
      CATALOG_APPLIED
    );
    assert.strictEqual(
      (await catalog.create("a.png", { kind: TEXTURE_KIND })).type,
      CATALOG_APPLIED
    );
    await catalog.sync.projector.flush();

    assert.strictEqual(catalog.sync.assetIndex.byPath("a.bin")?.kind, BINARY_KIND);
    assert.strictEqual(catalog.sync.assetIndex.byPath("a.png")?.kind, TEXTURE_KIND);
    assert.deepEqual(await catalog.sync.source.read("a.bin"), new Uint8Array());
    assert.deepEqual(await catalog.sync.source.read("a.png"), new Uint8Array());
  });

  test("resolves the kind from the path when omitted", async() => {
    await using catalog = await catalogServer([textureAssetKind()]);

    assert.strictEqual((await catalog.create("a.png")).type, CATALOG_APPLIED);
    assert.strictEqual(catalog.sync.assetIndex.byPath("a.png")?.kind, TEXTURE_KIND);
  });
});

describe("catalog:create with content", () => {
  test("rejects content its kind cannot load without writing", async() => {
    await using catalog = await catalogServer([{
      ...counterHandler(),
      load(state: CounterState, content: Uint8Array) {
        const value = text(content);
        if (!/^\d+$/.test(value)) {
          throw new Error("not a count");
        }
        state.value = Number(value);
      }
    }]);

    const reply = await catalog.create("score.counter", {
      content: bytes("four")
    });
    await catalog.sync.projector.flush();

    assert.strictEqual(reply.type, CATALOG_REJECTED);
    assert.strictEqual(reply.reason, "not a count");
    assert.strictEqual(catalog.sync.assetIndex.byPath("score.counter"), undefined);
  });
});

describe("catalog:create from another format", () => {
  test("writes the content the path's kind converted", async() => {
    await using catalog = await catalogServer([tallyCounter()]);

    const reply = await catalog.create("score.counter", {
      content: bytes("||||"),
      from: ".tally"
    });
    await catalog.sync.projector.flush();

    assert.strictEqual(reply.type, CATALOG_APPLIED);
    assert.strictEqual(catalog.sync.assetIndex.byPath("score.counter")?.kind, "counter");
    assert.strictEqual(text(await catalog.sync.source.read("score.counter")), "4");
  });

  test("rejects a format the kind does not convert", async() => {
    await using catalog = await catalogServer([tallyCounter()]);

    const reply = await catalog.create("score.counter", {
      content: bytes("4"),
      from: ".txt"
    });

    assert.strictEqual(reply.type, CATALOG_REJECTED);
    assert.strictEqual(
      reply.reason,
      "Asset kind \"counter\" cannot be created from \".txt\" content."
    );
    assert.strictEqual(catalog.sync.assetIndex.byPath("score.counter"), undefined);
  });

  test("rejects content the conversion refuses", async() => {
    await using catalog = await catalogServer([tallyCounter()]);

    const reply = await catalog.create("score.counter", {
      kind: "counter",
      content: bytes("four"),
      from: ".tally"
    });

    assert.strictEqual(reply.type, CATALOG_REJECTED);
    assert.strictEqual(reply.reason, "not a tally");
    assert.strictEqual(catalog.sync.assetIndex.byPath("score.counter"), undefined);
  });

  test("refuses a format without content to convert", async() => {
    await using catalog = await catalogServer([{
      ...counterHandler(),
      conversions: {
        ".tally": async() => bytes("1")
      }
    }]);

    const reply = await catalog.create("score.counter", {
      from: ".tally"
    });
    await catalog.sync.projector.flush();

    assert.notStrictEqual(reply.type, CATALOG_APPLIED);
    assert.strictEqual(catalog.sync.assetIndex.byPath("score.counter"), undefined);
  });
});
