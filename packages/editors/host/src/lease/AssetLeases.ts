// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  AssetId,
  AssetKind,
  AssetKindMismatchError,
  AssetNotFoundError,
  AssetRoom,
  type AssetRecordData
} from "@jolly-pixel/asset";
import type {
  ChangeOutbox,
  Room,
  SyncedDocument
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  AssetDocumentConflictError
} from "./errors/AssetDocumentConflictError.ts";
import { UnsettledChangesError } from "./errors/UnsettledChangesError.ts";
import type {
  AssetLease,
  AssetDocumentKind,
  AssetRoomLease
} from "./AssetLease.ts";

export interface RoomSource {
  room(
    name: string
  ): Room;
}

export interface EditorSessionClient extends RoomSource {
  destroy(): void;
}

export interface AssetRecords {
  record(
    assetId: string
  ): AssetRecordData | undefined;
}

export interface OutboxSource {
  open(
    room: string
  ): ChangeOutbox;
}

export interface AssetLeasesOptions {
  rooms: RoomSource;
  records: AssetRecords;
  /**
   * Keeps the pending changes of every document across page loads.
   * @default null
   */
  outboxes?: OutboxSource | null;
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
  readonly followPending: () => void;
  unsettled: boolean;
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
  readonly #outboxes: OutboxSource | null;
  readonly #entries = new Map<string, LeaseEntry<unknown>>();
  #unsettled = 0;
  #unsaved = false;
  #disposed = false;

  constructor(
    options: AssetLeasesOptions
  ) {
    super();

    this.#rooms = options.rooms;
    this.#records = options.records;
    this.#outboxes = options.outboxes ?? null;
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
    this.#reportUnsaved();
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
        new AssetKind(kindName),
        new AssetKind(record.kind)
      );
    }

    return existing ?? this.#create(record, tag, kind);
  }

  #create(
    record: AssetRecordData,
    tag: string | null,
    kind: AssetDocumentKind<unknown> | undefined
  ): LeaseEntry<unknown> {
    const roomName = new AssetRoom(record.kind, record.id, tag).toString();
    const room = this.#rooms.room(roomName);

    let synced: SyncedDocument<unknown> | undefined;
    try {
      synced = kind?.syncDocument(room);
      if (synced !== undefined) {
        if (this.#outboxes !== null && tag === null) {
          synced.pendingChanges.keepIn(this.#outboxes.open(roomName));
        }
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
      followPending: () => this.#followPending(entry),
      unsettled: false,
      holders: 0
    };
    this.#entries.set(
      leaseKey(record.id, tag),
      entry
    );
    synced?.pendingChanges.on("settled", entry.followPending);
    synced?.pendingChanges.on("unsettled", entry.followPending);
    entry.followPending();

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
    this.#reportUnsaved();
  }

  #close(
    entry: LeaseEntry<unknown>
  ): void {
    entry.synced?.pendingChanges.off("settled", entry.followPending);
    entry.synced?.pendingChanges.off("unsettled", entry.followPending);
    this.#markPending(entry, false);
    entry.synced?.dispose();
    entry.room.leave();
  }

  #followPending(
    entry: LeaseEntry<unknown>
  ): void {
    this.#markPending(entry, (entry.synced?.pendingChanges.pending ?? 0) > 0);
    this.#reportUnsaved();
  }

  #markPending(
    entry: LeaseEntry<unknown>,
    pending: boolean
  ): void {
    if (entry.unsettled !== pending) {
      entry.unsettled = pending;
      this.#unsettled += pending ? 1 : -1;
    }
  }

  #reportUnsaved(): void {
    const unsaved = this.#unsettled > 0;
    if (unsaved !== this.#unsaved) {
      this.#unsaved = unsaved;
      this.emit("unsaved", unsaved);
    }
  }
}
