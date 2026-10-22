// Import Third-party Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_SNAPSHOT,
  type CatalogMessage
} from "@jolly-pixel/asset-server/client";
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";
import {
  SyncedDocument,
  type ChangeOutbox,
  type DocumentSync,
  type Peer,
  type PeerMetadata,
  type Right,
  type Room,
  type RoomEventMap,
  type RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { AssetDocumentKind } from "#src/lease/AssetLease.ts";

export class FakeRoom extends Emitter<RoomEventMap> implements Room {
  readonly id: string;
  readonly clientId = "fake-client";
  readonly peers = new Map<string, Peer>();
  readonly profile = {};
  readonly role = "editor";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";
  readonly sent: unknown[] = [];
  joins = 0;
  leaves = 0;

  constructor(
    id: string
  ) {
    super();
    this.id = id;
  }

  can(): Right {
    return this.access;
  }

  send(
    message: unknown
  ): void {
    this.sent.push(message);
  }

  updatePresence(
    _patch: PeerMetadata
  ): void {
    return void 0;
  }

  join(): void {
    this.joins++;
  }

  resync(): void {
    return void 0;
  }

  resumeWith(): void {
    return void 0;
  }

  leave(): void {
    this.leaves++;
  }

  receive(
    message: unknown
  ): void {
    this.emit("message", message);
  }
}

export class FakeClient {
  readonly rooms = new Map<string, FakeRoom>();
  destroyed = false;

  room(
    name: string
  ): Room {
    let room = this.rooms.get(name);
    if (room === undefined) {
      room = new FakeRoom(name);
      this.rooms.set(name, room);
    }

    return room;
  }

  destroy(): void {
    this.destroyed = true;
  }

  fakeRoom(
    name: string
  ): FakeRoom {
    const room = this.rooms.get(name);
    if (room === undefined) {
      throw new Error(`no room ${name}`);
    }

    return room;
  }
}

export function snapshotMessage(
  assets: AssetRecordData[],
  dependencies: Record<string, AssetReferenceData[]> = {}
): CatalogMessage {
  return {
    type: CATALOG_SNAPSHOT,
    manifest: {
      version: 1,
      assets
    },
    dependencies,
    folders: []
  };
}

export function changedMessage(
  assetId: string,
  record: AssetRecordData | null,
  dependencies?: AssetReferenceData[]
): CatalogMessage {
  return {
    type: CATALOG_CHANGED,
    changes: [{
      eventType: record === null ? "asset.deleted" : "asset.updated",
      assetId,
      record,
      dependencies
    }]
  };
}

export class FakeDocumentSync extends Emitter<{
  settled: () => void;
  unsettled: () => void;
}> implements DocumentSync {
  readonly ready = false;
  readonly loading = Promise.withResolvers<void>();
  pending = 0;
  outbox: ChangeOutbox | null = null;
  destroyed = false;

  whenReady(): Promise<void> {
    return this.loading.promise;
  }

  destroy(): void {
    this.destroyed = true;
  }

  keepIn(
    outbox: ChangeOutbox
  ): void {
    this.outbox = outbox;
  }

  edit(): void {
    this.pending++;
    if (this.pending === 1) {
      this.emit("unsettled");
    }
  }

  acknowledge(): void {
    this.pending = 0;
    this.emit("settled");
  }
}

export class FakeDocument {
  readonly room: Room;
  readonly changes = new FakeDocumentSync();

  get disposed(): boolean {
    return this.changes.destroyed;
  }

  constructor(
    room: Room
  ) {
    this.room = room;
  }
}

class FakeSyncedDocument extends SyncedDocument<FakeDocument> {
  readonly document: FakeDocument;

  constructor(
    document: FakeDocument
  ) {
    super(document.changes);
    this.document = document;
  }
}

export interface FakeDocumentKind extends AssetDocumentKind<FakeDocument> {
  readonly documents: FakeDocument[];
  resolveAll(): void;
  rejectAll(error: Error): void;
}

export function fakeDocumentKind(
  kind: string
): FakeDocumentKind {
  const documents: FakeDocument[] = [];
  const pending: FakeDocumentSync[] = [];

  return {
    kind,
    documents,
    resolveAll: () => {
      for (const { loading } of pending.splice(0)) {
        loading.resolve();
      }
    },
    rejectAll: (error) => {
      for (const { loading } of pending.splice(0)) {
        loading.reject(error);
      }
    },
    syncDocument(room): SyncedDocument<FakeDocument> {
      const document = new FakeDocument(room);
      documents.push(document);
      pending.push(document.changes);

      return new FakeSyncedDocument(document);
    }
  };
}

export function record(
  id: string,
  kind: string
): AssetRecordData {
  return {
    id,
    kind,
    path: `${id}.${kind}`
  };
}
