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

export async function historySetup() {
  const peers = await edgePeerSetup();
  const history = new CommandHistory<"terrain">();
  history.register(terrainHistoryRegistration(peers.document, { scope: "terrain" }));
  const skipped: string[] = [];
  history.on("skipped", (_scope, step) => skipped.push(step.refused.reason));

  async function stroke(...heights: number[]): Promise<void> {
    const step = history.open("terrain", null);
    for (const height of heights) {
      peers.sculpt(height);
    }
    step.commit();
    await peers.route();
  }

  return { ...peers, history, skipped, stroke };
}

export function peerTile(
  tile: TileCoord,
  height: number
): EncodedTilePatch {
  return encodeTilePatch({ tile, heights: tileHeights(height) });
}
