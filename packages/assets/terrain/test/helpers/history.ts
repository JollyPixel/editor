// Import Third-party Dependencies
import { CommandHistory } from "@jolly-pixel/history";
import type { TileCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  encodeTilePatch,
  type EncodedTilePatch
} from "#src/index.ts";
import { terrainHistoryRegistration } from "#src/network/client.ts";
import { edgePeerSetup } from "./peers.ts";
import { tileHeights } from "./terrain.ts";

export function historySetup() {
  const peers = edgePeerSetup();
  const history = new CommandHistory<"terrain">();
  history.register(terrainHistoryRegistration(peers.document, { scope: "terrain" }));
  const skipped: string[] = [];
  history.on("skipped", (_scope, step) => skipped.push(step.refused.reason));

  function stroke(...heights: number[]): void {
    const step = history.open("terrain", null);
    for (const height of heights) {
      peers.sculpt(height);
    }
    step.commit();
    peers.route();
  }

  return { ...peers, history, skipped, stroke };
}

export function peerTile(
  tile: TileCoord,
  height: number
): EncodedTilePatch {
  return encodeTilePatch({ tile, heights: tileHeights(height) });
}
