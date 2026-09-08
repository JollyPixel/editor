// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  READ_BACKEND_KINDS,
  openSeededStores,
  seedInputs
} from "./_fixtures.ts";

// CONSTANTS
const kAssets = 200;
const kPerAsset = 50;
const kTotalEvents = kAssets * kPerAsset;
const kCheckpointIndex = 40;
const kPageSize = 100;
const kTailVersion = kPerAsset - 5;

const suite = defineSuite("event-store / reads", async(bench) => {
  const inputs = seedInputs({
    assets: kAssets,
    perAsset: kPerAsset,
    checkpointIndex: kCheckpointIndex
  });
  const seeded = await openSeededStores(inputs, READ_BACKEND_KINDS);

  let sink = 0;

  for (const { kind, store } of seeded.entries) {
    const { reader } = store;

    bench
      .add(
        `list / whole ${kPerAsset} event stream [${kind}]`,
        () => {
          sink += reader.list("asset-0").length;
        }
      )
      .add(
        `list / tail after version ${kTailVersion} [${kind}]`,
        () => {
          sink += reader.list("asset-0", kTailVersion).length;
        }
      )
      .add(
        `lastVersionOf / 2 event types [${kind}]`,
        () => {
          sink += reader.lastVersionOf(
            "asset-0",
            ["asset.created", "asset.snapshot"]
          );
        }
      )
      .add(
        `listAll / whole ${kTotalEvents} event log [${kind}]`,
        () => {
          sink += reader.listAll().length;
        }
      )
      .add(
        `listAll / "pixelart." prefix [${kind}]`,
        () => {
          sink += reader.listAll({ eventTypePrefix: "pixelart." }).length;
        }
      )
      .add(
        `listAll / "asset." prefix, 4% selective [${kind}]`,
        () => {
          sink += reader.listAll({ eventTypePrefix: "asset." }).length;
        }
      )
      .add(
        `listAll / ${kPageSize} event page near the head [${kind}]`,
        () => {
          sink += reader.listAll({
            fromEventId: kTotalEvents - kPageSize,
            limit: kPageSize
          }).length;
        }
      );
  }

  return () => {
    seeded.dispose();
    if (sink < 0) {
      throw new Error("unreachable");
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
