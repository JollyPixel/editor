// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import { FilesystemAssetSource } from "@jolly-pixel/asset-source/node";
import {
  Server,
  type ClientConnection
} from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";
import { createAssetBackend } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_KIND,
  createVoxelModelFile,
  VOXEL_MODEL_FILE,
  voxelModelAssetKind
} from "#src/index.ts";
import {
  blockAdded,
  folderAdded,
  networkCommand
} from "../helpers/commands.ts";

// CONSTANTS
const kFilePath = "model.voxelmodel.json";
const kTexture = {
  id: "texture-1",
  kind: "pixelart"
};

interface SentMessage {
  kind?: string;
  payload?: {
    type?: string;
    data?: unknown;
  };
}

function client(
  id: string,
  sent: SentMessage[] = []
): ClientConnection {
  return {
    id,
    sendSerialized: (json) => {
      sent.push(JSON.parse(json));
    },
    close: () => void 0
  };
}

async function withBackend(
  run: (context: {
    root: string;
    eventStore: EventStore.EventStore;
    backend: Awaited<ReturnType<typeof createAssetBackend>>;
    recordId: string;
  }) => Promise<void>
): Promise<void> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "jolly-voxel-model-"));
  try {
    using eventStore = EventStore.persistence.memory();
    await fs.writeFile(
      path.join(root, kFilePath),
      VOXEL_MODEL_FILE.encode(createVoxelModelFile({
        texture: kTexture,
        blocks: []
      }))
    );
    await using backend = await createAssetBackend({
      source: new FilesystemAssetSource(root),
      eventStore,
      handlers: [voxelModelAssetKind({ snapshot: { delay: 0 } })],
      reconcile: {
        watch: false
      }
    });
    const record = backend.catalog.snapshot().assets
      .find((entry) => entry.path === kFilePath)!;

    await run({
      root,
      eventStore,
      backend,
      recordId: record.id
    });
  }
  finally {
    await fs.rm(root, {
      recursive: true,
      force: true
    });
  }
}

describe("voxel-model asset kind over a real back-end", () => {
  test("indexes the texture as a dependency", async() => {
    await withBackend(async({ backend, recordId }) => {
      assert.equal(backend.catalog.snapshot().assets[0].kind, VOXEL_MODEL_KIND);
      assert.deepEqual(backend.catalog.dependencies.listDependencies(recordId), [kTexture]);
    });
  });

  test("one room carries block and folder commands to the file", async() => {
    await withBackend(async({ root, eventStore, backend, recordId }) => {
      const server = new Server();
      backend.attach(server);
      const room = new AssetRoom(VOXEL_MODEL_KIND, recordId).toString();
      const sent: SentMessage[] = [];

      const connectionA = server.connect(client("A", sent), { subject: "A", role: "default" });
      await connectionA.receive({ room, kind: "join" });
      for (const command of [
        folderAdded("f"),
        blockAdded("a", "f"),
        { action: "node-renamed", id: "missing", name: "x" } as const,
        blockAdded("b", "missing")
      ]) {
        await connectionA.receive({
          room,
          kind: "message",
          payload: networkCommand(command)
        });
      }

      const appended = eventStore.reader
        .list(recordId)
        .filter((event) => event.eventType === VOXEL_MODEL_COMMAND);
      assert.equal(appended.length, 2);

      await backend.flush(recordId);
      const onDisk = VOXEL_MODEL_FILE.decode(
        await fs.readFile(path.join(root, kFilePath))
      );
      assert.deepEqual(
        onDisk.nodes.map((node) => [node.id, node.parentId]),
        [["f", null], ["a", "f"]]
      );
      assert.deepEqual(onDisk.texture, kTexture);

      const snapshot = sent.find((message) => message.payload?.type === "snapshot");
      assert.deepEqual(snapshot?.payload?.data, {
        nodes: [],
        materials: [],
        animationSets: []
      });

      await server.close();
    });
  });
});
