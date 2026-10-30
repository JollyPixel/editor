// Import Node.js Dependencies
import type { TestContext } from "node:test";
import { setImmediate } from "node:timers/promises";

// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import type { ChunkRect } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  chunksInRect,
  terrainHistoryRegistration,
  type ChunkContents
} from "#src/network/client.ts";
import { terrainPeers } from "./peers.ts";
import {
  heights,
  networkCommand
} from "./terrain.ts";

// CONSTANTS
const kStrip = 13;

export function stripPeers(
  t: TestContext
) {
  const peers = terrainPeers();
  t.after(peers.dispose);
  for (let x = 1; x < kStrip; x++) {
    peers.server.receive("X", networkCommand(
      { action: "chunk-added", x, z: 0, heights: heights(x) },
      { clientId: "X" }
    ));
  }
  const peer = peers.join("A");
  const history = new CommandHistory<"terrain">();
  history.register(terrainHistoryRegistration(peer.document, { scope: "terrain" }));

  async function read(
    rect: ChunkRect
  ): Promise<ChunkContents[]> {
    const coords = chunksInRect(rect);
    const collected: ChunkContents[] = [];
    const reading = (async() => {
      for await (const chunk of peer.document.stream.read(coords)) {
        collected.push(chunk);
      }
    })();
    await setImmediate();
    peers.route();
    await reading;

    return collected;
  }

  return { ...peers, ...peer, history, read };
}
