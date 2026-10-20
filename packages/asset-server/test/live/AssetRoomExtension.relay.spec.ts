// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  type AssetCommandHeader,
  type AssetLiveProtocol,
  type AssetRelay
} from "#src/index.ts";
import { counterSnapshotSchema } from "../helpers/protocols.ts";
import {
  counterRoomBinding,
  counterRoomCommands
} from "../helpers/rooms.ts";

interface Command extends AssetCommandHeader {
  action: string;
}

describe("AssetRoomExtension — relay", () => {
  test("refuses a relay declared by its schemas or its handler alone", () => {
    const nudge = z.object({ action: z.literal("nudge") });
    const relay: AssetRelay<z.infer<typeof nudge>> = {
      receive: () => assert.fail("no relay message reaches a refused room")
    };
    const commands = counterRoomCommands<Command>();
    const live: AssetLiveProtocol<Command> = {
      snapshotSchema: counterSnapshotSchema,
      snapshot: () => {
        return { value: 0 };
      },
      arbitrate: (command) => {
        return { command };
      }
    };
    const events: EventStore.EventWriter = {
      append: () => assert.fail("nothing is appended")
    };

    assert.throws(
      () => new AssetRoomExtension(
        counterRoomBinding(),
        {
          ...commands,
          relay: {
            inbound: [nudge],
            outbound: []
          }
        },
        live,
        events
      ),
      { name: "TypeError", message: /schemas but no live\(\)\.relay/ }
    );
    assert.throws(
      () => new AssetRoomExtension(
        counterRoomBinding(),
        commands,
        {
          ...live,
          relay
        },
        events
      ),
      { name: "TypeError", message: /live\(\)\.relay but no commands\.relay schemas/ }
    );
  });
});
