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
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import {
  Server,
  type ClientHandle
} from "@jolly-pixel/network";
import { AssetRoom } from "@jolly-pixel/asset";
import { createAssetBackend } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  VOXEL_MODEL_COMMAND,
  VOXEL_MODEL_KIND,
  createVoxelModelDocument,
  decodeVoxelModelDocument,
  encodeVoxelModelDocument,
  voxelModelAssetKind
} from "#src/index.ts";
import {
  blockAdded,
  folderAdded,
  networkCommand
} from "../helpers/commands.ts";

// CONSTANTS
const kDocumentPath = "model.voxelmodel.json";
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
): ClientHandle {
  return {
    id,
    send: (message) => {
      sent.push(message as SentMessage);
    }
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
      path.join(root, kDocumentPath),
      encodeVoxelModelDocument(createVoxelModelDocument({
        texture: kTexture,
        blocks: []
      }))
    );
    await using backend = await createAssetBackend({
      source: new FilesystemAssetSource(root),
      eventStore,
      handlers: [voxelModelAssetKind({ snapshot: { delay: 0 } })],
      watch: false
    });
    const record = backend.catalog.snapshot().assets
      .find((entry) => entry.source === kDocumentPath)!;

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
      assert.deepEqual(backend.catalog.dependencies.dependenciesOf(recordId), [kTexture]);
    });
  });

  test("one room carries block and folder commands to the file", async() => {
    await withBackend(async({ root, eventStore, backend, recordId }) => {
      const server = new Server();
      backend.attach(server);
      const room = new AssetRoom(VOXEL_MODEL_KIND, recordId).toString();
      const sent: SentMessage[] = [];

      server.handleConnect(client("A", sent), { subject: "A", role: "default" });
      await server.handleMessage("A", { room, kind: "join" });
      for (const command of [
        folderAdded("f"),
        blockAdded("a", "f"),
        { action: "node-renamed", id: "missing", name: "x" } as const,
        blockAdded("b", "missing")
      ]) {
        await server.handleMessage("A", {
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
      const onDisk = decodeVoxelModelDocument(
        await fs.readFile(path.join(root, kDocumentPath))
      );
      assert.deepEqual(
        onDisk.nodes.map((node) => [node.id, node.parentId]),
        [["f", null], ["a", "f"]]
      );
      assert.deepEqual(onDisk.texture, kTexture);

      const snapshot = sent.find((message) => message.payload?.type === "snapshot");
      assert.deepEqual(snapshot?.payload?.data, {
        nodes: []
      });

      await server.close();
    });
  });
});
