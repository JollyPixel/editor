// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import { syncHarness } from "../helpers/backend.ts";
import {
  tileHandler,
  TILE_CHANGED,
  type TileState
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

describe("AssetStateStore — live content updates", () => {
  test("a command waits for the held parts of the content update before it", async() => {
    await using backing = EventStore.persistence.memory();
    const heldReads = Promise.withResolvers<void>();
    let holdReads = false;
    const eventStore: EventStore.EventStore = {
      ...backing,
      reader: {
        ...backing.reader,
        get: async(assetId, eventVersion) => {
          if (holdReads) {
            await heldReads.promise;
          }

          return backing.reader.get(assetId, eventVersion);
        }
      }
    };
    await using harness = await syncHarness({
      eventStore,
      handlers: [tileHandler()]
    });
    const { assetId } = (await harness.writer.create({
      path: "w.tiles",
      actor: kActor
    })).unwrap();
    const entry = await harness.states.acquire(assetId, "tiles");

    holdReads = true;
    (await harness.writer.update({
      assetId,
      data: bytes("a,b"),
      parts: new Map([["b", bytes("sand")]]),
      actor: kActor
    })).unwrap();
    (await eventStore.writer.append({
      assetType: "tiles",
      assetId,
      eventType: TILE_CHANGED,
      eventData: { action: "paint", tile: "a", value: "water" },
      actor: kActor
    })).unwrap();
    heldReads.resolve();
    await setImmediate();

    assert.deepEqual(
      Object.fromEntries((entry.state as TileState).tiles),
      {
        a: "water",
        b: "sand"
      }
    );
  });
});
