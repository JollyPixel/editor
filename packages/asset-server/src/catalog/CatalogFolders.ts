// Import Third-party Dependencies
import {
  FolderSet,
  isWithinFolder,
  normalizeAssetPath,
  type AssetSource
} from "@jolly-pixel/asset-source";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CatalogChange } from "./client/protocol.ts";
import type { CatalogProjection } from "./CatalogProjection.ts";
import { FolderMovedIntoItselfError } from "./errors/FolderMovedIntoItselfError.ts";
import { TaskChain } from "../utils/TaskChain.ts";

export type CatalogFoldersEventMap = {
  changed: (
    folders: readonly string[]
  ) => void;
};

export interface CatalogFoldersOptions {
  source: AssetSource;
  catalog: CatalogProjection;
  flush: () => Promise<void>;
}

export class CatalogFolders extends Emitter<
  CatalogFoldersEventMap
> {
  #source: AssetSource;
  #catalog: CatalogProjection;
  #flush: () => Promise<void>;
  #folders = new FolderSet();
  #queue = new TaskChain();

  constructor(
    options: CatalogFoldersOptions
  ) {
    super();
    this.#source = options.source;
    this.#catalog = options.catalog;
    this.#flush = options.flush;
    this.#catalog.on(
      "changed",
      this.#onChanged
    );
  }

  toJSON(): string[] {
    return this.#folders.toJSON();
  }

  refresh(): Promise<void> {
    return this.#queue.run(
      () => this.#refresh()
    );
  }

  async create(
    path: string
  ): Promise<string> {
    const folder = normalizeAssetPath(path);

    return this.#queue.run(async() => {
      await this.#source.createFolder(folder);
      await this.#refresh();

      return folder;
    });
  }

  async delete(
    path: string
  ): Promise<string> {
    const folder = normalizeAssetPath(path);

    return this.#queue.run(async() => {
      await this.#flush();
      await this.#source.deleteFolder(folder);
      await this.#refresh();

      return folder;
    });
  }

  async move(
    from: string,
    to: string
  ): Promise<string> {
    const origin = normalizeAssetPath(from);
    const target = normalizeAssetPath(to);
    if (isWithinFolder(target, origin)) {
      throw new FolderMovedIntoItselfError(
        origin,
        target
      );
    }

    return this.#queue.run(async() => {
      await this.#flush();
      await this.#refresh();
      for (const folder of this.#folders.subtree(origin)) {
        await this.#source.createFolder(
          `${target}${folder.slice(origin.length)}`
        );
      }
      await this.#source.deleteFolder(origin);
      await this.#refresh();

      return target;
    });
  }

  close(): void {
    this.#catalog.off(
      "changed",
      this.#onChanged
    );
    this.removeAllListeners();
  }

  async #refresh(): Promise<void> {
    const folders = new FolderSet(
      await this.#source.folders()
    );
    for (const record of this.#catalog.catalog) {
      folders.addParentsOf(record.source);
    }

    if (!folders.equals(this.#folders)) {
      this.#folders = folders;
      this.emit("changed", this.toJSON());
    }
  }

  readonly #onChanged = (
    change: CatalogChange
  ): void => {
    if (change.record === null) {
      return;
    }

    const { size } = this.#folders;
    this.#folders.addParentsOf(
      change.record.source
    );
    if (this.#folders.size !== size) {
      this.emit("changed", this.toJSON());
    }
  };
}
