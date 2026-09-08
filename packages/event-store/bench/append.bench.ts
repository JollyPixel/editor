// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  BACKEND_KINDS,
  openStore,
  seed,
  seedInputs,
  type BackendKind,
  type OpenedStore
} from "./_fixtures.ts";
import type * as EventStore from "../src/index.ts";

// CONSTANTS
const kSeedAssets = 50;
const kSeedPerAsset = 4;
const kRotatingAssets = 1000;
const kLargePayloadBytes = 4096;

const suite = defineSuite("event-store / append", async(bench) => {
  const opened: OpenedStore[] = [];

  for (const kind of BACKEND_KINDS) {
    const small = await seededStore(kind);
    const rotating = await seededStore(kind);
    const large = await seededStore(kind);
    const listening = await seededStore(kind);
    opened.push(small, rotating, large, listening);

    listening.store.writer.on("append", noop);

    bench
      .add(
        `64 B payload, hot asset [${kind}]`,
        appender(small.store, () => "asset-0")
      )
      .add(
        `64 B payload, ${kRotatingAssets} assets [${kind}]`,
        appender(rotating.store, rotatingAssetId())
      )
      .add(
        `${kLargePayloadBytes} B payload, hot asset [${kind}]`,
        appender(large.store, () => "asset-0", kLargePayloadBytes)
      )
      .add(
        `64 B payload, "append" listener [${kind}]`,
        appender(listening.store, () => "asset-0")
      );
  }

  return () => {
    for (const entry of opened) {
      entry.dispose();
    }
  };
});

export default suite;

async function seededStore(
  kind: BackendKind
): Promise<OpenedStore> {
  const opened = await openStore(kind);
  seed(
    opened.store,
    seedInputs({
      assets: kSeedAssets,
      perAsset: kSeedPerAsset
    })
  );

  return opened;
}

function appender(
  store: EventStore.EventStore,
  assetId: () => string,
  payloadBytes = 64
): () => void {
  const input: EventStore.AppendInput = {
    assetType: "texture",
    assetId: "asset-0",
    eventType: "pixelart.stroke.applied",
    eventData: {
      x: 12,
      y: 34,
      pixels: "p".repeat(payloadBytes)
    },
    actor: {
      type: "user",
      id: "alice"
    }
  };

  return function append() {
    input.assetId = assetId();
    store.writer.append(input).unwrap();
  };
}

function rotatingAssetId(): () => string {
  let index = 0;

  return function next() {
    index = (index + 1) % kRotatingAssets;

    return `asset-${index}`;
  };
}

function noop(): void {
  return;
}

if (import.meta.main) {
  await runSuites([suite]);
}
