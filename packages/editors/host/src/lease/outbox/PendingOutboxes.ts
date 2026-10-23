// Import Third-party Dependencies
import type { ChangeOutbox } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { OwnerLock } from "./OwnerLock.ts";
import {
  OutboxStore,
  type KeptCommand
} from "./OutboxStore.ts";
import { RoomOutbox } from "./RoomOutbox.ts";

export interface PendingOutboxesOptions {
  /**
   * @default globalThis.indexedDB
   */
  indexedDB?: IDBFactory;
  /**
   * @default globalThis.navigator.locks
   */
  locks?: LockManager;
}

export class PendingOutboxes {
  static async open(
    options: PendingOutboxesOptions = {}
  ): Promise<PendingOutboxes | null> {
    const {
      indexedDB = globalThis.indexedDB,
      locks = globalThis.navigator?.locks
    } = options;
    if (indexedDB === undefined || locks === undefined) {
      return null;
    }

    let lock: OwnerLock | null = null;
    let store: OutboxStore | null = null;
    try {
      lock = await OwnerLock.acquire(locks);
      store = await OutboxStore.open({
        indexedDB,
        owner: lock.id
      });
      const claimed = await store.claim(await lock.liveOwners());

      return new PendingOutboxes(lock, store, claimed);
    }
    catch {
      await store?.close();
      lock?.release();

      return null;
    }
  }

  readonly #lock: OwnerLock;
  readonly #store: OutboxStore;
  readonly #claimed: Map<string, KeptCommand[]>;
  readonly #rooms = new Map<string, RoomOutbox>();

  constructor(
    lock: OwnerLock,
    store: OutboxStore,
    claimed: Map<string, KeptCommand[]>
  ) {
    this.#lock = lock;
    this.#store = store;
    this.#claimed = claimed;
  }

  open(
    room: string
  ): ChangeOutbox {
    let outbox = this.#rooms.get(room);
    if (outbox === undefined) {
      outbox = new RoomOutbox({
        room,
        store: this.#store,
        kept: this.#claimed.get(room) ?? []
      });
      this.#claimed.delete(room);
      this.#rooms.set(room, outbox);
    }

    return outbox;
  }

  async close(): Promise<void> {
    await this.#store.close();
    this.#lock.release();
  }
}
