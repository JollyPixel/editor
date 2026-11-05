// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { createIdentity } from "../../helpers/server/identity.ts";
import { createClient } from "../../helpers/server/clientConnection.ts";
import { createRoom } from "../../helpers/server/serverRoom.ts";
import { RecordingExtension } from "../../helpers/server/RecordingExtension.ts";
import { actionProtocols } from "../../helpers/protocol/protocols.ts";
import { RightsTable } from "#src/index.ts";

class QueryExtension extends RecordingExtension {
  override readonly queries = ["object-added"];

  constructor() {
    super("pixel-draw", "pixel-draw", actionProtocols);
  }
}

describe("ServerRoom — queries", () => {
  test("a query event reaches the extension with \"read\" but not with \"void\"", async() => {
    const extension = new QueryExtension();
    const a = createClient("A");
    const b = createClient("B");
    const room = createRoom(extension, new RightsTable({
      viewer: {
        "pixel-draw.$join": "write",
        "pixel-draw.*": "read"
      },
      blind: {
        "pixel-draw.$join": "write",
        "pixel-draw.*": "void"
      }
    }));
    await room.join({ handle: a.client, identity: createIdentity("A", "viewer") });
    await room.join({ handle: b.client, identity: createIdentity("B", "blind") });

    await room.message("A", { action: "object-added" });
    await room.message("B", { action: "object-added" });
    await room.message("A", { action: "voxel-set" });

    assert.deepEqual(extension.messages, [{ clientId: "A", payload: { action: "object-added" } }]);
  });
});
