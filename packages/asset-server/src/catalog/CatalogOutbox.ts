// Import Internal Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_FOLDERS,
  type CatalogChange,
  type CatalogMessage
} from "./client/protocol.ts";

export class CatalogOutbox {
  readonly #send: (message: CatalogMessage) => void;
  #changes: CatalogChange[] = [];
  #folders: string[] | null = null;
  #holds = 0;

  constructor(
    send: (message: CatalogMessage) => void
  ) {
    this.#send = send;
  }

  pushChange(
    change: CatalogChange
  ): void {
    this.#changes.push(change);
    this.#flushUnlessHeld();
  }

  pushFolders(
    folders: readonly string[]
  ): void {
    this.#folders = [...folders];
    this.#flushUnlessHeld();
  }

  async hold<TResult>(
    task: () => Promise<TResult>
  ): Promise<TResult> {
    this.#holds++;
    try {
      return await task();
    }
    finally {
      this.#holds--;
      this.#flushUnlessHeld();
    }
  }

  flush(): void {
    const folders = this.#folders;
    const changes = this.#changes;
    this.#folders = null;
    this.#changes = [];
    if (folders !== null) {
      this.#send({
        type: CATALOG_FOLDERS,
        folders
      });
    }
    if (changes.length > 0) {
      this.#send({
        type: CATALOG_CHANGED,
        changes
      });
    }
  }

  #flushUnlessHeld(): void {
    if (this.#holds === 0) {
      this.flush();
    }
  }
}
