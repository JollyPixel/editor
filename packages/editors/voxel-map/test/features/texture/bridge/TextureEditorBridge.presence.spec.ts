// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/pixel-draw.renderer";
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { TextureEditorBridge } from "../../../../src/features/texture/bridge/TextureEditorBridge.ts";
import {
  flushFrames,
  makeFakeManager
} from "./textureBridgeFixtures.ts";

describe("TextureEditorBridge / room presence", () => {
  it("subscribes before joining the room", () => {
    const calls: string[] = [];
    const room = {
      peers: new Map(),

      role: "default",

      rights: {},

      access: "write" as const,

      can: () => "write" as const,
      on: (event: string) => calls.push(`subscribe:${event}`),
      off: () => void 0,
      join: () => calls.push("join"),
      leave: () => void 0,
      send: () => void 0,
      updatePresence: () => void 0
    } as unknown as network.Room<PixelNetworkCommand, PixelServerMessage>;
    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });

    bridge.attach(makeFakeManager(() => false), room);

    /*
     * Both the document and the cursor sync must be listening first: a
     * snapshot or a presence patch arriving before them would be dropped.
     */
    assert.equal(calls.at(-1), "join");
    assert.equal(
      calls.filter((call) => call === "subscribe:peer-presence").length,
      4,
      "cursor, UV, stroke and selection previews all subscribe before join"
    );
    bridge.destroy();
  });

  it("streams local stroke and selection progress as presence, and stops on destroy", () => {
    const patches: Record<string, unknown>[] = [];
    const room = {
      peers: new Map(),

      role: "default",

      rights: {},

      access: "write" as const,

      can: () => "write" as const,
      on: () => void 0,
      off: () => void 0,
      join: () => void 0,
      leave: () => void 0,
      send: () => void 0,
      updatePresence: (patch: Record<string, unknown>) => patches.push(patch)
    } as unknown as network.Room<PixelNetworkCommand, PixelServerMessage>;
    const manager = makeFakeManager(() => false);
    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });

    bridge.attach(manager, room);

    /*
     * Both previews are non-authoritative: without them a peer only sees a
     * stroke or a selection once it commits.
     */
    assert.equal(typeof manager.onStrokeProgress, "function");
    manager.onStrokeProgress!([{ x: 1, y: 2, color: { r: 255, g: 0, b: 0, a: 255 } }]);
    manager.selectionEvents.emit("selection-progress", {
      phase: "creating",
      rect: { x: 0, y: 0, width: 4, height: 4 }
    });
    flushFrames();
    assert.deepEqual(
      patches.flatMap((patch) => Object.keys(patch)).sort(),
      ["selectionGhost", "strokeGhost"]
    );

    patches.length = 0;
    bridge.destroy();
    assert.equal(manager.onStrokeProgress, undefined);
    manager.selectionEvents.emit("selection-progress", {
      phase: "creating",
      rect: { x: 0, y: 0, width: 4, height: 4 }
    });
    flushFrames();
    assert.deepEqual(patches, []);
  });
});
