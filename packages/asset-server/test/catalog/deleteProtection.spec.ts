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
import {
  createAssetBackend,
  type AssetBackend
} from "#src/index.ts";
import type {
  CatalogClient,
  CatalogRejectedError
} from "#src/catalog/client/index.ts";
import {
  linkContent,
  linkHandler
} from "../helpers/kinds.ts";
import { bytes } from "../helpers/bytes.ts";
import { connectCatalog } from "../helpers/catalog.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};

interface LinkedProject extends AsyncDisposable {
  readonly backend: AssetBackend;
  readonly catalog: CatalogClient;
  readonly targetId: string;
  readonly linkId: string;
}

async function linkedProject(
  deleteProtection?: boolean
): Promise<LinkedProject> {
  const eventStore = EventStore.persistence.memory();
  const backend = await createAssetBackend({
    source: new MemoryAssetSource(),
    eventStore,
    handlers: [linkHandler()],
    catalog: {
      deleteProtection
    },
    reconcile: {
      watch: false
    }
  });
  const target = (await backend.writer.create({
    path: "textures/grass.png",
    data: bytes("grass"),
    actor: kActor
  })).unwrap();
  const link = (await backend.writer.create({
    path: "a.link",
    data: linkContent(target.assetId),
    actor: kActor
  })).unwrap();

  const connection = await connectCatalog(backend);

  return {
    backend,
    catalog: connection.catalog,
    targetId: target.assetId,
    linkId: link.assetId,
    async [Symbol.asyncDispose]() {
      await connection[Symbol.asyncDispose]();
      await backend.close();
      eventStore.close();
    }
  };
}

describe("catalog delete protection", () => {
  test("refuses a delete while another asset references the target", async() => {
    await using project = await linkedProject();

    await assert.rejects(
      project.catalog.remove(project.targetId),
      (error: CatalogRejectedError) => {
        assert.strictEqual(error.name, "CatalogRejectedError");
        assert.match(error.message, /still referenced by "a\.link"/);

        return true;
      }
    );
    await project.backend.flush();

    assert.notStrictEqual(
      project.backend.catalog.record(project.targetId),
      undefined
    );
    assert.notStrictEqual(
      project.catalog.record(project.targetId),
      undefined
    );
  });

  test("deletes a referenced asset when the caller forces it", async() => {
    await using project = await linkedProject();

    await project.catalog.remove(project.targetId, { force: true });
    await project.backend.flush();

    assert.strictEqual(
      project.backend.catalog.record(project.targetId),
      undefined
    );
  });

  test("deletes freely once the last dependent is gone", async() => {
    await using project = await linkedProject();

    await project.catalog.remove(project.linkId);
    await project.catalog.remove(project.targetId);
    await project.backend.flush();

    assert.strictEqual(project.backend.catalog.size, 0);
  });

  test("lets the backend opt out of the protection", async() => {
    await using project = await linkedProject(false);

    await project.catalog.remove(project.targetId);
    await project.backend.flush();

    assert.strictEqual(
      project.backend.catalog.record(project.targetId),
      undefined
    );
  });
});
