// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  CHECKPOINT_EVENT_TYPES,
  READ_BACKEND_KINDS,
  openSeededStores,
  seedInputs,
  type SeededStores
} from "./_fixtures.ts";

// CONSTANTS
const kAssets = 100;
const kShallowPerAsset = 21;
const kShallowCheckpointIndex = 1;
const kDeepPerAsset = 400;
const kDeepCheckpointIndex = 380;

const suite = defineSuite("event-store / listFromCheckpoints", async(bench) => {
  const opened: SeededStores[] = [];
  let sink = 0;

  const fixtures = [
    {
      label: `shallow, ${kAssets * kShallowPerAsset} events`,
      inputs: seedInputs({
        assets: kAssets,
        perAsset: kShallowPerAsset,
        checkpointIndex: kShallowCheckpointIndex
      })
    },
    {
      label: `deep, ${kAssets * kDeepPerAsset} events`,
      inputs: seedInputs({
        assets: kAssets,
        perAsset: kDeepPerAsset,
        checkpointIndex: kDeepCheckpointIndex
      })
    }
  ];

  for (const { label, inputs } of fixtures) {
    const seeded = await openSeededStores(inputs, READ_BACKEND_KINDS);
    opened.push(seeded);

    for (const { kind, store } of seeded.entries) {
      const { reader } = store;

      bench
        .add(
          `listFromCheckpoints / ${label} [${kind}]`,
          () => {
            sink += reader.listFromCheckpoints({
              checkpointEventTypes: CHECKPOINT_EVENT_TYPES
            }).length;
          }
        )
        .add(
          `listAll / ${label} [${kind}]`,
          () => {
            sink += reader.listAll().length;
          }
        );
    }
  }

  return () => {
    for (const seeded of opened) {
      seeded.dispose();
    }
    if (sink < 0) {
      throw new Error("unreachable");
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
