// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  CHECKPOINT_EVENT_TYPES,
  READ_BACKEND_KINDS,
  openStore,
  seed,
  seedInputs,
  type BackendKind,
  type OpenedStore
} from "./_fixtures.ts";
import type * as EventStore from "../src/index.ts";

// CONSTANTS
const kAssets = 50;
const kPerAsset = 20;
const kCheckpointIndex = 10;

const suite = defineSuite("event-store / compact", (bench) => {
  const inputs = seedInputs({
    assets: kAssets,
    perAsset: kPerAsset,
    checkpointIndex: kCheckpointIndex
  });
  const fixtures: Fixture[] = [];

  for (const kind of READ_BACKEND_KINDS) {
    for (const reclaim of [false, true]) {
      const fixture = new Fixture(kind, inputs);
      fixtures.push(fixture);

      bench.add(
        `compact / reclaim: ${reclaim} [${kind}]`,
        () => {
          fixture.store.compact({
            checkpointEventTypes: CHECKPOINT_EVENT_TYPES,
            reclaim
          });
        },
        {
          beforeEach: () => fixture.reset(),
          afterAll: () => fixture.dispose()
        }
      );
    }
  }

  return () => {
    for (const fixture of fixtures) {
      fixture.dispose();
    }
  };
});

export default suite;

class Fixture {
  #kind: BackendKind;
  #inputs: readonly EventStore.AppendInput[];
  #opened: OpenedStore | null = null;

  constructor(
    kind: BackendKind,
    inputs: readonly EventStore.AppendInput[]
  ) {
    this.#kind = kind;
    this.#inputs = inputs;
  }

  get store(): EventStore.EventStore {
    if (this.#opened === null) {
      throw new Error("fixture has not been reset");
    }

    return this.#opened.store;
  }

  async reset(): Promise<void> {
    this.dispose();
    this.#opened = await openStore(this.#kind);
    seed(this.#opened.store, this.#inputs);
  }

  dispose(): void {
    this.#opened?.dispose();
    this.#opened = null;
  }
}

if (import.meta.main) {
  await runSuites([suite]);
}
