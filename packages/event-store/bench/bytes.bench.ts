// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  BACKEND_KINDS,
  openStore,
  type OpenedStore
} from "./_fixtures.ts";
import type * as EventStore from "../src/index.ts";

// CONSTANTS
const kContentBytes = 1024 * 1024;
const kCheckpointEventTypes = ["asset.updated"];

const suite = defineSuite("event-store / bytes", async(bench) => {
  const opened: OpenedStore[] = [];
  const content = new Uint8Array(kContentBytes).map((_, index) => index);
  let sink = 0;

  for (const kind of BACKEND_KINDS) {
    const written = await openStore(kind);
    const read = await openStore(kind);
    opened.push(written, read);
    (await read.store.writer.append(contentEvent(content))).unwrap();

    bench
      .add(
        `append / 1 MiB Uint8Array [${kind}]`,
        async() => {
          (await written.store.writer.append(contentEvent(content))).unwrap();
        }
      )
      .add(
        `listFromCheckpoints / 1 MiB Uint8Array [${kind}]`,
        async() => {
          sink += (await read.store.reader.listFromCheckpoints({
            assetId: "asset-0",
            checkpointEventTypes: kCheckpointEventTypes
          })).length;
        }
      );
  }

  return async() => {
    for (const entry of opened) {
      await entry.dispose();
    }
    if (sink < 0) {
      throw new Error("unreachable");
    }
  };
});

export default suite;

function contentEvent(
  content: Uint8Array
): EventStore.AppendInput {
  return {
    assetType: "binary",
    assetId: "asset-0",
    eventType: "asset.updated",
    eventData: {
      path: "a.bin",
      content: {
        type: "inline",
        data: content
      }
    },
    actor: {
      type: "user",
      id: "alice"
    }
  };
}

if (import.meta.main) {
  await runSuites([suite]);
}
