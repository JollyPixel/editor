// Import Node.js Dependencies
import {
  describe,
  test,
  before
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  LiveAssetRoom,
  mockAssetRoom
} from "@jolly-pixel/asset-server/testing";

// Import Internal Dependencies
import {
  oggContentFromAudio,
  soundAssetKind,
  type SoundState
} from "#src/index.ts";
import {
  SoundDocument,
  soundDocumentKind
} from "#src/network/client.ts";
import type {
  SoundCommand,
  SoundNetworkCommand
} from "#src/network/types.ts";
import { sineWaveFile } from "../helpers/wavFiles.ts";

// CONSTANTS
const kOggContent = new Uint8Array([0x4F, 0x67, 0x67, 0x53, 0, 2, 7, 9]);

let seq = 0;

function networkCommand(
  set: SoundCommand["set"],
  clientId: string
): SoundNetworkCommand {
  seq++;

  return {
    action: "sound-settings-changed",
    set,
    clientId,
    seq,
    timestamp: 1000 + seq,
    basis: 0
  };
}

async function createRoom(
  content: Uint8Array
): Promise<LiveAssetRoom<SoundState, SoundNetworkCommand>> {
  const handler = soundAssetKind();
  const server = new LiveAssetRoom(handler);
  handler.load(server.state, content);
  await server.connect("A");

  return server;
}

async function join(
  server: LiveAssetRoom<SoundState, SoundNetworkCommand>,
  clientId: string
): Promise<SoundDocument> {
  const room = mockAssetRoom<SoundNetworkCommand, Uint8Array>(clientId);
  const { document } = soundDocumentKind().syncDocument(room);
  await server.connect(clientId);
  for (const message of server.take<Uint8Array>(clientId)) {
    room.deliver(message);
  }

  return document;
}

describe("sound room", () => {
  let ogg: Uint8Array;

  before(async() => {
    ogg = await oggContentFromAudio(sineWaveFile({
      seconds: 0.5,
      sampleRate: 48_000,
      channels: 1
    }));
  });

  test("hands the stored Ogg bytes to a joining client", async() => {
    const server = await createRoom(kOggContent);

    const document = await join(server, "B");

    assert.deepEqual(document.bytes, kOggContent);
  });

  test("brings a joining peer to the settings changed before it joined", async() => {
    const server = await createRoom(ogg);
    await server.receive("A", networkCommand({ category: "music", loop: true }, "A"));

    const document = await join(server, "B");

    assert.equal(document.settings.category, "music");
    assert.equal(document.settings.loop, true);
    assert.deepEqual(document.bytes, server.state.bytes);
  });

  test("writes the same bytes locally as the room does for one change", async() => {
    const server = await createRoom(ogg);
    const local = new SoundDocument();
    local.load(ogg);

    local.change({ volume: 0.4 });
    await server.receive("A", networkCommand({ volume: 0.4 }, "A"));

    assert.deepEqual(local.bytes, server.state.bytes);
  });

  test("refuses a volume above 1", async() => {
    const server = await createRoom(ogg);

    await assert.rejects(
      () => server.receive("A", networkCommand({ volume: 2 }, "A")),
      TypeError
    );
  });
});
