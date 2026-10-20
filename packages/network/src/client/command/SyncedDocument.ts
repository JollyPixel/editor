// Import Internal Dependencies
import type { PendingChanges } from "./CommandSync.ts";

export interface DocumentSync extends PendingChanges {
  readonly ready: boolean;

  whenReady(): Promise<void>;
  destroy(): void;
}

export abstract class SyncedDocument<TDocument> {
  abstract readonly document: TDocument;
  readonly ready: Promise<void>;

  #sync: DocumentSync;

  get loaded(): boolean {
    return this.#sync.ready;
  }

  get pendingChanges(): PendingChanges {
    return this.#sync;
  }

  constructor(
    sync: DocumentSync
  ) {
    this.#sync = sync;
    this.ready = sync.whenReady();
  }

  dispose(): void {
    this.#sync.destroy();
  }
}
