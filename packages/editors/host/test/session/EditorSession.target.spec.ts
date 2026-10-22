// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import { AssetId, type AssetReferenceData } from "@jolly-pixel/asset";
import {
  CATALOG_EXPORT,
  CATALOG_APPLIED,
  CATALOG_ROOM,
  type CatalogExportCommand
} from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";
import { fakeConnection, MAP } from "../helpers/session/connection.ts";
import {
  changedMessage,
  fakeDocumentKind,
  type FakeDocumentKind
} from "../helpers/rooms.ts";

interface OpenOptions {
  target?: string;
  accepts?: string;
  kinds?: AssetDocumentKind<unknown>[];
  dependencies?: Record<string, AssetReferenceData[]>;
  resolveDocuments?: FakeDocumentKind;
  launch?: EditorLaunch;
}

async function startOpen(
  options: OpenOptions
) {
  const { client, connection } = await fakeConnection({
    dependencies: options.dependencies
  });
  const pending = connection.openSession({
    launch: options.launch ?? new EditorLaunch(
      new AssetId(options.target ?? "map")
    ),
    kinds: options.kinds ?? [],
    accepts: options.accepts ?? "voxelmap"
  });
  pending.catch(() => undefined);

  return {
    client,
    pending
  };
}

async function open(
  options: OpenOptions = {}
) {
  const { client, pending } = await startOpen(options);
  options.resolveDocuments?.resolveAll();

  return {
    client,
    session: await pending
  };
}

function isExportCommand(
  message: unknown
): message is CatalogExportCommand & { requestId: string; } {
  return typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === CATALOG_EXPORT;
}

describe("EditorSession target document", () => {
  test("keeps the target room-only when no kind is registered", async() => {
    const { client, session } = await open();

    await session.targetReady;

    assert.equal(client.fakeRoom("voxelmap:map").joins, 0);
    assert.equal("document" in session.target, false);
    session.dispose();
  });

  test("leases the target as a document and joins its room once", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, session } = await open({
      kinds: [kind],
      resolveDocuments: kind
    });

    await session.targetReady;

    assert.equal(kind.documents.length, 1);
    assert.equal(client.fakeRoom("voxelmap:map").joins, 1);
    assert.equal(kind.documents[0].room, client.fakeRoom("voxelmap:map"));
    session.dispose();
  });

  test("rejects and leaves the target room when the target never becomes ready", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const failure = new Error("target failed");
    const { client, pending } = await startOpen({ kinds: [kind] });

    kind.rejectAll(failure);

    await assert.rejects(pending, failure);
    assert.equal(kind.documents[0].disposed, true);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 1);
  });

  test("targetLease shares the document the session already holds", async() => {
    const kind = fakeDocumentKind("voxelmap");
    const { client, session } = await open({
      kinds: [kind],
      resolveDocuments: kind
    });

    const lease = session.targetLease(kind);

    assert.equal(lease.document, kind.documents[0]);
    assert.equal(kind.documents.length, 1);

    lease.release();

    assert.equal(lease.document.disposed, false);
    assert.equal(client.fakeRoom("voxelmap:map").leaves, 0);

    session.dispose();

    assert.equal(lease.document.disposed, true);
  });
});

describe("EditorSession archives", () => {
  test("downloads the target under its current catalog path", async() => {
    const { client, session } = await open();
    const saved: string[] = [];
    const archives = session.archives({
      fallbackName: "map",
      resetWarning: "",
      browser: {
        location: {
          href: "http://localhost/",
          assign: () => undefined,
          reload: () => undefined
        },
        pickArchive: () => Promise.resolve(null),
        save: (_blob, fileName) => {
          saved.push(fileName);
        },
        askConflictPolicy: () => Promise.resolve(null),
        confirmReset: () => Promise.resolve(false)
      }
    });
    const catalog = client.fakeRoom(CATALOG_ROOM);
    catalog.receive(changedMessage("map", {
      ...MAP,
      path: "maps/overworld.voxelmap.json"
    }));

    const downloading = archives.download();
    await setTimeout();
    const command = catalog.sent.find(isExportCommand);
    assert.ok(command);
    catalog.receive({
      type: CATALOG_APPLIED,
      requestId: command.requestId,
      command: CATALOG_EXPORT,
      content: {
        type: "inline",
        encoding: "base64",
        data: ""
      }
    });
    await downloading;

    assert.equal(command.root, "map");
    assert.deepEqual(saved, ["overworld.zip"]);
    session.dispose();
  });
});
