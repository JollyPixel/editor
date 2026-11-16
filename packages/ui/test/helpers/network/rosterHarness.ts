// Import Third-party Dependencies
import { render } from "lit";

// Import Internal Dependencies
import { LogQueue } from "../../../src/feedback/LogQueue.ts";
import type { PresencePeer } from "../../../src/peer/PresencePeer.ts";
import { PeerRoster } from "../../../src/network/PeerRoster.ts";
import {
  createRoomHarness,
  type RoomHarness
} from "./roomHarness.ts";

// CONSTANTS
export const LOCAL_PROFILE = {
  username: "Ada",
  peerId: "local-peer"
};

export interface RosterHarness extends RoomHarness {
  roster: PeerRoster;
  log: LogQueue;
  peers: () => readonly PresencePeer[];
}

export function createRosterHarness(
  options: { log?: boolean; } = {}
): RosterHarness {
  const harness = createRoomHarness(LOCAL_PROFILE);
  const log = new LogQueue();
  let peers: readonly PresencePeer[] = [];

  const roster = new PeerRoster({
    room: harness.room,
    publish: (next) => {
      peers = next;
    },
    log: options.log === false ? undefined : log
  });

  return {
    ...harness,
    roster,
    log,
    peers: () => peers
  };
}

export function readMessages(
  log: LogQueue
): string[] {
  return log.entries.map((entry) => {
    const container = document.createElement("div");
    render(entry.content, container);

    return container.textContent?.trim() ?? "";
  });
}
