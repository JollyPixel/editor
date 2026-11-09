// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { MemoryAssetSource } from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import { createAssetBackend } from "#src/index.ts";
import {
  bytes,
  text
} from "../helpers/bytes.ts";
import { connectCatalog } from "../helpers/catalog.ts";
import { counterHandler } from "../helpers/kinds.ts";

describe("catalog:create progress", () => {
  test("tells the author each stage before the reply", async() => {
    const eventStore = EventStore.persistence.memory();
    await using stack = new AsyncDisposableStack();
    stack.defer(() => eventStore.close());
    const backend = await createAssetBackend({
      source: new MemoryAssetSource(),
      eventStore,
      handlers: [
        {
          ...counterHandler(),
          conversions: {
            ".tally": async(content) => {
              return {
                content: bytes(String(text(content).length))
              };
            }
          }
        }
      ],
      reconcile: {
        watch: false
      }
    });
    stack.defer(() => backend.close());
    const connection = stack.use(await connectCatalog(backend));
    const stages: string[] = [];

    await connection.catalog.create("score.counter", bytes("||"), {
      from: ".tally",
      onProgress: (stage) => stages.push(stage)
    });
    await connection.catalog.create("plain.counter", bytes("2"), {
      onProgress: (stage) => stages.push(stage)
    });

    assert.deepEqual(stages, ["converting", "writing", "writing"]);
  });
});
