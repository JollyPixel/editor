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
import {
  AssetDocumentConflictError
} from "./errors/AssetDocumentConflictError.ts";
import type {
  AssetLease,
  AssetDocumentKind,
  AssetRoomLease,
  SyncedDocument
} from "./AssetLease.ts";

export interface RoomSource {
  room(
    name: string
  ): Room;
}

export interface AssetRecords {
  record(
    assetId: string
  ): AssetRecordData | undefined;
}

export interface AssetLeasesOptions {
  rooms: RoomSource;
  records: AssetRecords;
}

interface LeaseEntry<TDocument> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly kind: AssetDocumentKind<TDocument> | undefined;
  readonly synced: SyncedDocument<TDocument> | undefined;
  holders: number;
}

interface DocumentLeaseEntry<
  TDocument
> extends LeaseEntry<TDocument> {
  readonly kind: AssetDocumentKind<TDocument>;
  readonly synced: SyncedDocument<TDocument>;
}

function hasDocumentKind<TDocument>(
  entry: LeaseEntry<unknown>,
  kind: AssetDocumentKind<TDocument>
): entry is DocumentLeaseEntry<TDocument> {
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

  open<TDocument, TCommand, TMessage>(
    kind: AssetDocumentKind<TDocument, TCommand, TMessage>,
    assetId: string
  ): AssetLease<TDocument, TCommand, TMessage> {
    const entry = this.#acquire(
      kind.kind,
      assetId,
      kind
    );
    if (!hasDocumentKind(entry, kind)) {
      throw new AssetDocumentConflictError(assetId);
    }

    return {
      ...this.#lease<TCommand, TMessage>(entry),
      document: entry.synced.document,
      ready: entry.synced.ready
    };
  }

  openRoom<TCommand = unknown, TMessage = unknown>(
    kind: string,
    assetId: string
  ): AssetRoomLease<TCommand, TMessage> {
    return this.#lease(
      this.#acquire(kind, assetId)
    );
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
    kind?: AssetDocumentKind<unknown>
  ): LeaseEntry<unknown> {
    if (this.#disposed) {
      throw new Error("Asset leases have been disposed.");
    }

    const existing = this.#entries.get(assetId);
    const record = existing?.record ?? this.#records.record(assetId);
    if (record === undefined) {
      throw new AssetNotFoundError(
        new AssetId(assetId)
      );
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
    kind: AssetDocumentKind<unknown> | undefined
  ): LeaseEntry<unknown> {
    const room = this.#rooms.room(
      new AssetRoom(
        record.kind,
        record.id
      ).toString()
    );

    let synced: SyncedDocument<unknown> | undefined;
    try {
      synced = kind?.createDocument(room);
      if (synced !== undefined) {
        room.join();
      }
    }
    catch (error) {
      synced?.dispose();
      room.leave();

      throw error;
    }

    const entry: LeaseEntry<unknown> = {
      record,
      room,
      kind,
      synced,
      holders: 0
    };
    this.#entries.set(
      record.id,
      entry
    );

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
