// Import Node.js Dependencies
import type { TestContext } from "node:test";

// Import Third-party Dependencies
import type {
  FakeNetwork,
  FakeRoom
} from "@jolly-pixel/network/testing";

// Import Internal Dependencies
import { ModelCollaboration } from "#src/collaboration/ModelCollaboration.ts";
import type { AnimationPlayer } from "#src/player/AnimationPlayer.ts";
import { loadedPlayer } from "./player.ts";

export interface Viewer {
  room: FakeRoom;
  player: AnimationPlayer;
  collaboration: ModelCollaboration;
}

export function connect(
  network: FakeNetwork,
  clientId: string
): Viewer {
  const room = network.connect(clientId);
  const { player } = loadedPlayer();
  const collaboration = new ModelCollaboration({
    room,
    player
  });

  return {
    room,
    player,
    collaboration
  };
}

export function clock(
  t: TestContext,
  viewers: Viewer[]
): (milliseconds: number) => void {
  t.mock.timers.enable({
    apis: ["Date", "setInterval"],
    now: 1_000
  });

  return (milliseconds) => {
    for (const { player } of viewers) {
      player.update(milliseconds / 1000);
    }
    t.mock.timers.tick(milliseconds);
  };
}
