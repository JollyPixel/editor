// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
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
import { UnsettledChangesError } from "./errors/UnsettledChangesError.ts";
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

export type AssetLeasesEvents = {
  unsaved: (unsaved: boolean) => void;
};

interface LeaseEntry<TDocument> {
  readonly tag: string | null;
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

function leaseKey(
  assetId: string,
  tag: string | null
): string {
  return JSON.stringify([assetId, tag]);
}

function hasDocumentKind<TDocument>(
  entry: LeaseEntry<unknown>,
  kind: AssetDocumentKind<TDocument>
): entry is DocumentLeaseEntry<TDocument> {
  return entry.kind === kind;
}

export class AssetLeases extends Emitter<AssetLeasesEvents> {
  readonly #rooms: RoomSource;
  readonly #records: AssetRecords;
  readonly #entries = new Map<string, LeaseEntry<unknown>>();
  #unsaved = false;
  #disposed = false;

  readonly #onPendingChange = (): void => {
    const unsaved = [...this.#entries.values()].some(
      (entry) => (entry.synced?.pendingChanges.pending ?? 0) > 0
    );
    if (unsaved !== this.#unsaved) {
      this.#unsaved = unsaved;
      this.emit("unsaved", unsaved);
    }
  };

  constructor(
    options: AssetLeasesOptions
  ) {
    super();

    this.#rooms = options.rooms;
    this.#records = options.records;
  }

  get unsaved(): boolean {
    return this.#unsaved;
  }

  settled(
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.#unsaved) {
      return Promise.resolve();
    }
    if (signal?.aborted) {
      return Promise.reject(new UnsettledChangesError(signal.reason));
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>();
    const unsubscribe = this.subscribe("unsaved", (unsaved) => {
      if (!unsaved) {
        resolve();
      }
    });
    function abort(): void {
      reject(new UnsettledChangesError(signal?.reason));
    }
    signal?.addEventListener("abort", abort, { once: true });

    return promise.finally(() => {
      unsubscribe();
      signal?.removeEventListener("abort", abort);
    });
  }

  has(
    assetId: string,
    tag: string | null = null
  ): boolean {
    return this.#entries.has(leaseKey(assetId, tag));
  }

  holders(
    assetId: string,
    tag: string | null = null
  ): number {
    return this.#entries.get(leaseKey(assetId, tag))?.holders ?? 0;
  }

  open<TDocument, TCommand, TMessage>(
    kind: AssetDocumentKind<TDocument, TCommand, TMessage>,
    assetId: string,
    tag: string | null = null
  ): AssetLease<TDocument, TCommand, TMessage> {
    const entry = this.#acquire(
      kind.kind,
      assetId,
      tag,
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
    assetId: string,
    tag: string | null = null
  ): AssetRoomLease<TCommand, TMessage> {
    return this.#lease(
      this.#acquire(kind, assetId, tag)
    );
  }

  dispose(): void {
    this.#disposed = true;
    for (const entry of this.#entries.values()) {
      this.#close(entry);
    }
    this.#entries.clear();
    this.#onPendingChange();
  }

  #acquire(
    kindName: string,
    assetId: string,
    tag: string | null,
    kind?: AssetDocumentKind<unknown>
  ): LeaseEntry<unknown> {
    if (this.#disposed) {
      throw new Error("Asset leases have been disposed.");
    }

    const existing = this.#entries.get(leaseKey(assetId, tag));
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

    return existing ?? this.#create(record, tag, kind);
  }

  #create(
    record: AssetRecordData,
    tag: string | null,
    kind: AssetDocumentKind<unknown> | undefined
  ): LeaseEntry<unknown> {
    const room = this.#rooms.room(
      new AssetRoom(record.kind, record.id, tag).toString()
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
      tag,
      record,
      room,
      kind,
      synced,
      holders: 0
    };
    this.#entries.set(
      leaseKey(record.id, tag),
      entry
    );
    synced?.pendingChanges.on("settled", this.#onPendingChange);
    synced?.pendingChanges.on("unsettled", this.#onPendingChange);
    this.#onPendingChange();

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
    const key = leaseKey(entry.record.id, entry.tag);
    if (
      entry.holders > 0 ||
      this.#entries.get(key) !== entry
    ) {
      return;
    }

    this.#entries.delete(key);
    this.#close(entry);
    this.#onPendingChange();
  }

  #close(
    entry: LeaseEntry<unknown>
  ): void {
    entry.synced?.pendingChanges.off("settled", this.#onPendingChange);
    entry.synced?.pendingChanges.off("unsettled", this.#onPendingChange);
    entry.synced?.dispose();
    entry.room.leave();
  }
}
