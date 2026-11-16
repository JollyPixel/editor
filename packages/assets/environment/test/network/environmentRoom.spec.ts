// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  environmentAssetKind,
  type EnvironmentState
} from "#src/index.ts";
import { environmentDocumentKind } from "#src/network/environmentDocumentKind.ts";
import type {
  EnvironmentCommand,
  EnvironmentFile,
  EnvironmentNetworkCommand
} from "#src/network/types.ts";

let seq = 0;

function networkCommand(
  set: EnvironmentCommand["set"],
  clientId: string
): EnvironmentNetworkCommand {
  seq++;

  return {
    action: "environment-changed",
    set,
    clientId,
    seq,
    timestamp: 1000 + seq,
    basis: 0
  };
}

async function createRoom(): Promise<LiveAssetRoom<EnvironmentState, EnvironmentNetworkCommand>> {
  const server = new LiveAssetRoom(environmentAssetKind());
  await server.connect("A");
  await server.connect("B");

  return server;
}

describe("environment room", () => {
  test("keeps two peers' concurrent edits of different sections", async() => {
    const server = await createRoom();

    await server.receive("A", networkCommand({ sky: { kind: "night" } }, "A"));
    await server.receive("B", networkCommand({
      fog: { kind: "exp2", color: "#102030", density: 0.05 }
    }, "B"));

    const { sky, fog } = server.state.snapshot();
    assert.deepEqual(sky, { kind: "night" });
    assert.deepEqual(fog, { kind: "exp2", color: "#102030", density: 0.05 });
  });

  test("refuses a change with an elevation past the zenith", async() => {
    const server = await createRoom();

    await assert.rejects(() => server.receive("A", networkCommand({
      sun: { color: "#ffffff", intensity: 1, azimuth: 0, elevation: 120 }
    }, "A")), TypeError);
  });

  test("brings a joining peer's document to the room's environment", async() => {
    const server = await createRoom();
    await server.receive("A", networkCommand({ toneMapping: { kind: "agx", exposure: 1.1 } }, "A"));

    const room = mockAssetRoom<EnvironmentNetworkCommand, EnvironmentFile>("C");
    const { document } = environmentDocumentKind().syncDocument(room);
    await server.connect("C");
    for (const message of server.take<EnvironmentFile>("C")) {
      room.deliver(message);
    }

    assert.deepEqual(document.file, server.state.snapshot());
  });
});
