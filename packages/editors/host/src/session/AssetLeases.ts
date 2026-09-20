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
import { AssetModelConflictError } from "./errors/AssetModelConflictError.ts";
import type {
  AssetLease,
  AssetModelKind,
  AssetRoomLease,
  SyncedModel
} from "./AssetLease.ts";

export interface RoomSource {
  room(name: string): Room;
}

export interface AssetRecords {
  record(assetId: string): AssetRecordData | undefined;
}

export interface AssetLeasesOptions {
  rooms: RoomSource;
  records: AssetRecords;
}

interface LeaseEntry<TModel> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly kind: AssetModelKind<TModel> | undefined;
  readonly synced: SyncedModel<TModel> | undefined;
  holders: number;
}

interface ModelLeaseEntry<TModel> extends LeaseEntry<TModel> {
  readonly kind: AssetModelKind<TModel>;
  readonly synced: SyncedModel<TModel>;
}

function isModelledBy<TModel>(
  entry: LeaseEntry<unknown>,
  kind: AssetModelKind<TModel>
): entry is ModelLeaseEntry<TModel> {
  return entry.kind === kind;
}

export class AssetLeases {
  readonly #rooms: RoomSource;
  readonly #records: AssetRecords;
  readonly #entries = new Map<string, LeaseEntry<unknown>>();
  #disposed = false;

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
    const entry = this.#acquire(kind.kind, assetId, kind);
    if (!isModelledBy(entry, kind)) {
      throw new AssetModelConflictError(assetId);
    }

    return {
      ...this.#lease<TCommand, TMessage>(entry),
      model: entry.synced.model,
      ready: entry.synced.ready
    };
  }

  openRoom<TCommand = unknown, TMessage = unknown>(
    kind: string,
    assetId: string
  ): AssetRoomLease<TCommand, TMessage> {
    return this.#lease(this.#acquire(kind, assetId));
  }

  dispose(): void {
    this.#disposed = true;
    for (const entry of this.#entries.values()) {
      this.#close(entry);
    }
    this.#entries.clear();
  }

  #acquire(
    kindName: string,
    assetId: string,
    kind?: AssetModelKind<unknown>
  ): LeaseEntry<unknown> {
    if (this.#disposed) {
      throw new Error("Asset leases have been disposed.");
    }
    const existing = this.#entries.get(assetId);
    const record = existing?.record ?? this.#records.record(assetId);
    if (record === undefined) {
      throw new AssetNotFoundError(new AssetId(assetId));
    }
    if (record.kind !== kindName) {
      throw new AssetKindMismatchError(
        new AssetId(assetId),
        kindName,
        record.kind
      );
    }

    return existing ?? this.#create(record, kind);
  }

  #create(
    record: AssetRecordData,
    kind: AssetModelKind<unknown> | undefined
  ): LeaseEntry<unknown> {
    const room = this.#rooms.room(
      new AssetRoom(record.kind, record.id).toString()
    );
    const synced = kind?.createModel(room);
    if (synced !== undefined) {
      try {
        room.join();
      }
      catch (error) {
        synced.dispose();
        room.leave();

        throw error;
      }
    }

    const entry: LeaseEntry<unknown> = {
      record,
      room,
      kind,
      synced,
      holders: 0
    };
    this.#entries.set(record.id, entry);

    return entry;
  }

  #lease<TCommand, TMessage>(
    entry: LeaseEntry<unknown>
  ): AssetRoomLease<TCommand, TMessage> {
    entry.holders++;

    let released = false;

    return {
      record: entry.record,
      room: entry.room,
      release: () => {
        if (released) {
          return;
        }
        released = true;
        this.#release(entry);
      }
    };
  }

  #release(
    entry: LeaseEntry<unknown>
  ): void {
    entry.holders--;
    if (
      entry.holders > 0 ||
      this.#entries.get(entry.record.id) !== entry
    ) {
      return;
    }

    this.#entries.delete(entry.record.id);
    this.#close(entry);
  }

  #close(
    entry: LeaseEntry<unknown>
  ): void {
    entry.synced?.dispose();
    entry.room.leave();
  }
}
