// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  GRID_KIND,
  GRID_PAINTED,
  bytesOf,
  gridHandler,
  paintCommand
} from "./_fixtures.ts";
import {
  ASSET_UPDATED,
  foldAssetEvent,
  parseAssetEvent,
  writeData
} from "../src/index.ts";
import { contentHash } from "../src/utils/contentHash.ts";

// CONSTANTS
const kSizes = [4_096, 1_048_576];
const kActor: EventStore.Actor = {
  type: "user",
  id: "author"
};

const suite = defineSuite("asset-server / event primitives", async(bench) => {
  const handler = gridHandler({ contentBytes: 4_096 });
  const state = handler.create("grid-0");
  const painted = eventOf(GRID_PAINTED, paintCommand(1));

  bench.add("fold domain command", () => {
    foldAssetEvent(handler, state, painted);
  });

  for (const size of kSizes) {
    const data = bytesOf(size, size);
    const updated = eventOf(
      ASSET_UPDATED,
      await writeData("grids/grid-0.grid", GRID_KIND, data)
    );
    const label = `${size / 1_024} KB`;

    bench
      .add(`contentHash [${label}]`, () => contentHash(data))
      .add(`writeData [${label}]`, () => writeData(
        "grids/grid-0.grid",
        GRID_KIND,
        data
      ))
      .add(`parseAssetEvent [${label}]`, () => {
        parseAssetEvent(updated);
      });
  }
});

export default suite;

function eventOf(
  eventType: string,
  eventData: unknown
): EventStore.Event {
  return {
    eventId: 1,
    assetType: GRID_KIND,
    assetId: "grid-0",
    eventType,
    eventData,
    eventVersion: 2,
    actor: kActor,
    createdAt: "2023-11-14T22:13:20.000Z"
  };
}

if (import.meta.main) {
  await runSuites([suite]);
}
