// Import Third-party Dependencies
import {
  AssetId,
  AssetKindMismatchError,
  AssetNotFoundError,
  AssetRoom,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type { Room } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { AssetModelConflictError } from "../errors/AssetModelConflictError.ts";
import type {
  AssetLease,
  AssetModelKind,
  AssetRoomLease,
  SyncedModel
} from "./AssetLease.ts";

export interface RoomSource {
  room(name: string): Room<any, any>;
}

export interface AssetRecords {
  record(assetId: string): AssetRecordData | undefined;
}

export interface AssetLeasesOptions {
  rooms: RoomSource;
  records: AssetRecords;
}

type ModelFactory = (room: Room) => SyncedModel<unknown> | undefined;

interface LeaseEntry {
  record: AssetRecordData;
  room: Room;
  synced: SyncedModel<unknown> | undefined;
  holders: number;
}

export class AssetLeases {
  readonly #rooms: RoomSource;
  readonly #records: AssetRecords;
  readonly #entries = new Map<string, LeaseEntry>();

  constructor(
    options: AssetLeasesOptions
  ) {
    this.#rooms = options.rooms;
    this.#records = options.records;
  }

  has(
    assetId: string
  ): boolean {
    return this.#entries.has(assetId);
  }

  holders(
    assetId: string
  ): number {
    return this.#entries.get(assetId)?.holders ?? 0;
  }

  open<TModel, TCommand, TMessage>(
    kind: AssetModelKind<TModel, TCommand, TMessage>,
    assetId: string
  ): AssetLease<TModel, TCommand, TMessage> {
    const entry = this.#entries.get(assetId) ??
      this.#create(kind.kind, assetId, (room) => kind.createModel(room));
    const { synced } = entry;
    if (synced === undefined) {
      throw new AssetModelConflictError(assetId);
    }

    return {
      ...this.#lease<TCommand, TMessage>(assetId, entry),
      model: synced.model as TModel,
      ready: synced.ready
    };
  }

  openRoom<TCommand = any, TMessage = any>(
    kind: string,
    assetId: string
  ): AssetRoomLease<TCommand, TMessage> {
    const entry = this.#entries.get(assetId) ??
      this.#create(kind, assetId, () => undefined);

    return this.#lease(assetId, entry);
  }

  dispose(): void {
    for (const entry of this.#entries.values()) {
      this.#close(entry);
    }
    this.#entries.clear();
  }

  #lease<TCommand, TMessage>(
    assetId: string,
    entry: LeaseEntry
  ): AssetRoomLease<TCommand, TMessage> {
    entry.holders++;

    let released = false;

    return {
      record: entry.record,
      room: entry.room as Room<TCommand, TMessage>,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.#release(assetId, entry);
      }
    };
  }

  #create(
    kind: string,
    assetId: string,
    createModel: ModelFactory
  ): LeaseEntry {
    const record = this.#records.record(assetId);
    if (record === undefined) {
      throw new AssetNotFoundError(new AssetId(assetId));
    }
    if (record.kind !== kind) {
      throw new AssetKindMismatchError(
        new AssetId(assetId),
        kind,
        record.kind
      );
    }

    const room = this.#rooms.room(
      new AssetRoom(record.kind, record.id).toString()
    );
    const synced = createModel(room);
    if (synced !== undefined) {
      room.join();
    }

    const entry: LeaseEntry = {
      record,
      room,
      synced,
      holders: 0
    };
    this.#entries.set(assetId, entry);

    return entry;
  }

  #release(
    assetId: string,
    entry: LeaseEntry
  ): void {
    entry.holders--;
    if (entry.holders > 0 || this.#entries.get(assetId) !== entry) {
      return;
    }

    this.#entries.delete(assetId);
    this.#close(entry);
  }

  #close(
    entry: LeaseEntry
  ): void {
    entry.synced?.dispose();
    entry.room.leave();
  }
}
