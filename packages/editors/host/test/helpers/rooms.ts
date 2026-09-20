// Import Third-party Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_SNAPSHOT,
  type CatalogMessage
} from "@jolly-pixel/asset-server/catalog/client";
import type {
  AssetRecordData,
  AssetReferenceData
} from "@jolly-pixel/asset";
import { Emitter } from "@openally/emitt";
import type {
  Peer,
  PeerMetadata,
  Right,
  Room,
  RoomEventMap,
  RoomRights
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type {
  AssetModelKind,
  SyncedModel
} from "#src/session/AssetLease.ts";

export class FakeRoom extends Emitter<RoomEventMap> implements Room {
  readonly id: string;
  readonly clientId = "fake-client";
  readonly peers = new Map<string, Peer>();
  readonly role = "editor";
  readonly rights: RoomRights = {};
  readonly access: Right = "write";
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

  send(): void {
    return void 0;
  }

  updatePresence(
    _patch: PeerMetadata
  ): void {
    return void 0;
  }

  join(): void {
    this.joins++;
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
    dependencies
  };
}

export function changedMessage(
  assetId: string,
  record: AssetRecordData | null,
  dependencies?: AssetReferenceData[]
): CatalogMessage {
  return {
    type: CATALOG_CHANGED,
    change: {
      eventType: record === null ? "asset.deleted" : "asset.updated",
      assetId,
      record,
      dependencies
    }
  };
}

export interface FakeModel {
  readonly room: Room;
  disposed: boolean;
}

export interface FakeModelKind extends AssetModelKind<FakeModel> {
  readonly models: FakeModel[];
  resolveAll(): void;
  rejectAll(error: Error): void;
}

export function fakeModelKind(
  kind: string
): FakeModelKind {
  const models: FakeModel[] = [];
  const pending: Array<PromiseWithResolvers<void>> = [];

  return {
    kind,
    models,
    resolveAll: () => {
      for (const { resolve } of pending.splice(0)) {
        resolve();
      }
    },
    rejectAll: (error) => {
      for (const { reject } of pending.splice(0)) {
        reject(error);
      }
    },
    createModel(room): SyncedModel<FakeModel> {
      const model: FakeModel = {
        room,
        disposed: false
      };
      models.push(model);
      const resolvers = Promise.withResolvers<void>();
      pending.push(resolvers);

      return {
        model,
        ready: resolvers.promise,
        dispose: () => {
          model.disposed = true;
        }
      };
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
    source: `${id}.${kind}`
  };
}
