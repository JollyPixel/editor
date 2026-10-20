// Import Internal Dependencies
import {
  CATALOG_CHANGED,
  CATALOG_FOLDERS,
  CATALOG_TAGS_CHANGED,
  type CatalogChange,
  type CatalogMessage
} from "./client/protocol.ts";
import type { AssetTag } from "./tags/AssetTags.schema.ts";

export class CatalogOutbox {
  readonly #send: (message: CatalogMessage) => void;
  #changes: CatalogChange[] = [];
  #folders: string[] | null = null;
  #tags = new Map<string, readonly AssetTag[]>();
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

  pushTags(
    assetId: string,
    tags: readonly AssetTag[]
  ): void {
    this.#tags.set(assetId, tags);
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
    const tags = this.#tags;
    this.#folders = null;
    this.#changes = [];
    this.#tags = new Map();
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
    for (const [assetId, assetTags] of tags) {
      this.#send({
        type: CATALOG_TAGS_CHANGED,
        assetId,
        tags: assetTags
      });
    }
  }

  #flushUnlessHeld(): void {
    if (this.#holds === 0) {
      this.flush();
    }
  }
}
