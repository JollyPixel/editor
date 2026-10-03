// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  CATALOG_APPLIED,
  CATALOG_CREATE_FOLDER,
  CATALOG_DELETE_FOLDER,
  CATALOG_FOLDERS,
  CATALOG_MOVE_FOLDER,
  CATALOG_REJECTED
} from "#src/index.ts";
import { bytes } from "../helpers/bytes.ts";
import { catalogCommands } from "../helpers/catalog.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("catalog folder commands", () => {
  test("create-folder makes an empty folder and broadcasts the folder list", async() => {
    await using commands = await catalogCommands();

    await commands.send({
      type: CATALOG_CREATE_FOLDER,
      requestId: "r1",
      path: "maps/draft"
    });

    assert.deepEqual(await commands.sync.source.folders(), [
      "maps",
      "maps/draft"
    ]);
    assert.deepEqual(commands.room.broadcasts.at(-1), {
      type: CATALOG_FOLDERS,
      folders: ["maps", "maps/draft"]
    });
    assert.deepEqual(commands.lastDirect()?.payload, {
      type: CATALOG_APPLIED,
      requestId: "r1",
      command: CATALOG_CREATE_FOLDER,
      path: "maps/draft"
    });
  });

  test("delete-folder waits for pending projections before removing it", async() => {
    await using commands = await catalogCommands();
    const created = (await commands.sync.writer.create({
      path: "maps/overworld.json",
      data: bytes("{}"),
      actor: kActor
    })).unwrap();
    await commands.sync.projector.flush();
    await commands.sync.writer.remove({
      assetId: created.assetId,
      actor: kActor
    });

    await commands.send({
      type: CATALOG_DELETE_FOLDER,
      requestId: "r2",
      path: "maps"
    });

    assert.deepEqual(await commands.sync.source.folders(), []);
    assert.deepEqual(commands.room.broadcasts.at(-1), {
      type: CATALOG_FOLDERS,
      folders: []
    });
    assert.deepEqual(commands.lastDirect()?.payload, {
      type: CATALOG_APPLIED,
      requestId: "r2",
      command: CATALOG_DELETE_FOLDER,
      path: "maps"
    });
  });

  test("move-folder recreates the empty folders at the target", async() => {
    await using commands = await catalogCommands();
    await commands.sync.source.createFolder("maps/draft");

    await commands.send({
      type: CATALOG_MOVE_FOLDER,
      requestId: "r4",
      from: "maps",
      to: "levels/maps"
    });

    assert.deepEqual(await commands.sync.source.folders(), [
      "levels",
      "levels/maps",
      "levels/maps/draft"
    ]);
    assert.deepEqual(commands.lastDirect()?.payload, {
      type: CATALOG_APPLIED,
      requestId: "r4",
      command: CATALOG_MOVE_FOLDER,
      path: "levels/maps"
    });
  });

  test("rejects a folder escaping the project root", async() => {
    await using commands = await catalogCommands();

    await commands.send({
      type: CATALOG_CREATE_FOLDER,
      requestId: "r3",
      path: "../outside"
    });

    assert.strictEqual(
      (commands.lastDirect()!.payload as { type: string; }).type,
      CATALOG_REJECTED
    );
    assert.deepEqual(await commands.sync.source.folders(), []);
  });
});
