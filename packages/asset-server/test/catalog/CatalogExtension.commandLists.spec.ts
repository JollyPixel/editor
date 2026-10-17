// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_DELETE,
  CATALOG_FOLDERS,
  CATALOG_RENAME
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { catalogCommands, type CatalogCommands } from "../helpers/catalog.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

function lastPayloadType(
  commands: CatalogCommands
): string | undefined {
  const payload = commands.lastDirect()?.payload as { type?: string; } | undefined;

  return payload?.type;
}

async function createAll(
  commands: CatalogCommands,
  paths: string[]
): Promise<string[]> {
  const assetIds: string[] = [];
  for (const path of paths) {
    const created = (await commands.sync.writer.create({
      path,
      data: bytes(path),
      actor: kActor
    })).unwrap();
    assetIds.push(created.assetId);
  }

  return assetIds;
}

function broadcastsSince(
  commands: CatalogCommands,
  start: number
): { type: string; changes?: unknown[]; }[] {
  return commands.room.broadcasts.slice(start) as { type: string; changes?: unknown[]; }[];
}

describe("CatalogExtension — command lists", () => {
  test("a rename list broadcasts its folders and changes once, then the count", async() => {
    await using commands = await catalogCommands();
    const assetIds = await createAll(commands, ["a.png", "b.png", "c.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r110",
      renames: assetIds.map((assetId, index) => {
        return {
          assetId,
          to: `moved/sub-${index}/${index}.png`
        };
      })
    });

    const sent = broadcastsSince(commands, start);
    assert.deepEqual(sent.map(({ type }) => type), [CATALOG_FOLDERS, CATALOG_CHANGED]);
    assert.strictEqual(sent[1].changes?.length, 3);
    assert.strictEqual(commands.sync.identity.byId(assetIds[2])?.path, "moved/sub-2/2.png");
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r110",
        command: CATALOG_RENAME,
        applied: 3
      }
    });
  });

  test("a rename list stops at the first refused rename and names it", async() => {
    await using commands = await catalogCommands();
    const [a, b, c] = await createAll(commands, ["a.png", "b.png", "c.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r111",
      renames: [
        { assetId: a, to: "x.png" },
        { assetId: b, to: "c.png" },
        { assetId: c, to: "y.png" }
      ]
    });

    const reply = commands.lastDirect()?.payload as { applied?: number; failure?: string; };
    assert.strictEqual(reply.applied, 1);
    assert.strictEqual(typeof reply.failure, "string");
    assert.strictEqual(commands.sync.identity.byId(c)?.path, "c.png");
    const sent = broadcastsSince(commands, start);
    assert.deepEqual(sent.map(({ type }) => type), [CATALOG_CHANGED]);
    assert.strictEqual(sent[0].changes?.length, 1);
  });

  test("a list refused on its first entry applies nothing and broadcasts nothing", async() => {
    await using commands = await catalogCommands();
    const [a] = await createAll(commands, ["a.png", "b.png"]);
    const start = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_RENAME,
      requestId: "r112",
      renames: [{ assetId: a, to: "b.png" }]
    });

    const reply = commands.lastDirect()?.payload as { applied?: number; failure?: string; };
    assert.strictEqual(lastPayloadType(commands), CATALOG_APPLIED);
    assert.strictEqual(reply.applied, 0);
    assert.strictEqual(typeof reply.failure, "string");
    assert.deepEqual(broadcastsSince(commands, start), []);
  });

  test("a delete list removes every asset", async() => {
    await using commands = await catalogCommands();
    const assetIds = await createAll(commands, ["a.png", "b.png"]);

    await commands.send({
      type: CATALOG_DELETE,
      requestId: "r113",
      assetIds
    });

    assert.deepEqual(
      assetIds.map((assetId) => commands.sync.identity.byId(assetId)),
      [undefined, undefined]
    );
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r113",
        command: CATALOG_DELETE,
        applied: 2
      }
    });
  });
});
