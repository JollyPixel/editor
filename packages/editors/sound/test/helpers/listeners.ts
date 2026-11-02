// Import Node.js Dependencies
import type { TestContext } from "node:test";

// Import Third-party Dependencies
import type { SoundDocument } from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundCollaboration } from "#src/collaboration/SoundCollaboration.ts";
import type { SoundPlayer } from "#src/player/SoundPlayer.ts";
import type { FakeAudioContext } from "./FakeAudioContext.ts";
import type {
  FakeNetwork,
  FakeRoom
} from "./FakeNetwork.ts";
import { followingPlayer } from "./followingPlayer.ts";

// CONSTANTS
const kStepMs = 10;

export interface Listener {
  room: FakeRoom;
  context: FakeAudioContext;
  document: SoundDocument;
  player: SoundPlayer;
  collaboration: SoundCollaboration;
}

export async function connect(
  network: FakeNetwork,
  clientId: string
): Promise<Listener> {
  const room = network.connect(clientId);
  const { context, document, player } = await followingPlayer();
  const collaboration = new SoundCollaboration({
    room,
    player
  });

  return {
    room,
    context,
    document,
    player,
    collaboration
  };
}

export function clock(
  t: TestContext,
  listeners: Listener[]
): (milliseconds: number) => void {
  t.mock.timers.enable({
    apis: ["Date", "setInterval"],
    now: 1_000
  });

  return (milliseconds) => {
    for (let passed = 0; passed < milliseconds; passed += kStepMs) {
      const step = Math.min(kStepMs, milliseconds - passed);
      for (const { context } of listeners) {
        if (context.state === "running") {
          context.currentTime = Math.round(
            (context.currentTime + step / 1000) * 1e6
          ) / 1e6;
        }
      }
      t.mock.timers.tick(step);
    }
  };
}
