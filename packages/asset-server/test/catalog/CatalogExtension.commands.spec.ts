// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  encodeContent,
  CATALOG_APPLIED,
  CATALOG_CHANGED,
  CATALOG_CREATE,
  CATALOG_FOLDERS,
  CATALOG_REJECTED
} from "#src/index.ts";
import { bytes, text } from "../helpers/bytes.ts";
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

describe("CatalogExtension — commands", () => {
  test("create writes the asset, broadcasts the change and acknowledges the author", async() => {
    await using commands = await catalogCommands();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r1",
      path: "textures/grass.png",
      content: encodeContent(bytes("grass"))
    });
    await commands.sync.projector.flush();

    const record = commands.sync.assetIndex.byPath("textures/grass.png");
    assert.notStrictEqual(record, undefined);
    assert.strictEqual(
      text(await commands.sync.source.read("textures/grass.png")),
      "grass"
    );
    assert.deepEqual(commands.room.broadcasts[0], {
      type: CATALOG_FOLDERS,
      folders: ["textures"]
    });
    assert.strictEqual(
      (commands.room.broadcasts[1] as { type: string; }).type,
      CATALOG_CHANGED
    );
    assert.deepEqual(commands.lastDirect(), {
      clientId: "A",
      payload: {
        type: CATALOG_APPLIED,
        requestId: "r1",
        command: CATALOG_CREATE,
        assetId: record!.id
      }
    });
  });

  test("stamps lifecycle events with the context identity as actor", async() => {
    await using commands = await catalogCommands();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r101",
      path: "a.png",
      content: encodeContent(bytes("one"))
    });

    const [event] = await commands.sync.eventStore.reader.listAll({
      eventTypePrefix: "asset."
    });
    assert.deepEqual(event.actor, {
      type: "user",
      id: "alice-subject"
    });
  });

  test("rejects a path used by another asset to the author only", async() => {
    await using commands = await catalogCommands();
    await commands.sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });
    const broadcasts = commands.room.broadcasts.length;

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r3",
      path: "a.png",
      content: encodeContent(bytes("two"))
    });

    assert.strictEqual(commands.room.broadcasts.length, broadcasts);
    const payload = commands.lastDirect()?.payload as {
      type: string;
      requestId: string;
      command: string;
      reason: string;
    };
    assert.strictEqual(payload.type, CATALOG_REJECTED);
    assert.strictEqual(payload.requestId, "r3");
    assert.strictEqual(payload.command, CATALOG_CREATE);
    assert.match(payload.reason, /already used/);
  });

  test("creates next to a taken path when asked to suffix", async() => {
    await using commands = await catalogCommands();
    await commands.sync.writer.create({
      path: "a.png",
      data: bytes("one"),
      actor: kActor
    });

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r4",
      path: "a.png",
      onConflict: "suffix",
      content: encodeContent(bytes("two"))
    });

    const record = commands.sync.assetIndex.byPath("a-2.png");
    assert.notStrictEqual(record, undefined);
    assert.deepEqual(commands.lastDirect()?.payload, {
      type: CATALOG_APPLIED,
      requestId: "r4",
      command: CATALOG_CREATE,
      assetId: record!.id
    });
  });

  test("rejects an unsafe path without broadcasting", async() => {
    await using commands = await catalogCommands();

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r103",
      path: "../escape.png",
      content: encodeContent(bytes("x"))
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
    assert.deepEqual(commands.room.broadcasts, []);
  });

  test("rejects content over the size limit without writing", async() => {
    await using commands = await catalogCommands(4);

    await commands.send({
      type: CATALOG_CREATE,
      requestId: "r104",
      path: "a.png",
      content: encodeContent(bytes("12345"))
    });

    assert.strictEqual(lastPayloadType(commands), CATALOG_REJECTED);
    assert.strictEqual(commands.sync.assetIndex.byPath("a.png"), undefined);
  });
});
