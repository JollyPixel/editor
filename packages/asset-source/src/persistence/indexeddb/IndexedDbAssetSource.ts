// Import Third-party Dependencies
import {
  deleteDB,
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction
} from "idb";

// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import { AssetPathNotFoundError } from "../../errors/AssetPathNotFoundError.ts";
import {
  FolderSet,
  isStatePath,
  normalizeAssetPath
} from "../../paths/index.ts";

// CONSTANTS
const kDatabaseVersion = 2;
const kStoreNames = ["files", "folders"] as const;

interface AssetSchema extends DBSchema {
  files: {
    key: string;
    value: Uint8Array;
  };
  folders: {
    key: string;
    value: true;
  };
}

type AssetTransaction = IDBPTransaction<
  AssetSchema,
  typeof kStoreNames,
  "readwrite"
>;

export interface IndexedDbAssetSourceOptions {
  name: string;
}

export class IndexedDbAssetSource implements AssetSource {
  static async open(
    options: IndexedDbAssetSourceOptions
  ): Promise<IndexedDbAssetSource> {
    const database = await openDB<AssetSchema>(
      options.name,
      kDatabaseVersion,
      {
        upgrade(database) {
          for (const storeName of kStoreNames) {
            database.createObjectStore(storeName);
          }
        }
      }
    );

    return new IndexedDbAssetSource(database);
  }

  static async destroy(
    options: IndexedDbAssetSourceOptions
  ): Promise<void> {
    await deleteDB(options.name);
  }

  #database: IDBPDatabase<AssetSchema>;

  constructor(
    database: IDBPDatabase<AssetSchema>
  ) {
    this.#database = database;
    database.onversionchange = () => database.close();
  }

  async read(
    path: string
  ): Promise<Uint8Array> {
    const key = normalizeAssetPath(path);
    const data = await this.#database.get("files", key);
    if (data === undefined) {
      throw new AssetPathNotFoundError(key);
    }

    return data;
  }

  async exists(
    path: string
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);

    return await this.#database.getKey("files", key) !== undefined;
  }

  async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    await this.#write(
      (transaction) => this.#putFile(transaction, key, copy)
    );
  }

  async writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    return this.#write(async(transaction) => {
      const existing = await transaction.objectStore("files").getKey(key);
      if (existing !== undefined) {
        return false;
      }
      await this.#putFile(transaction, key, copy);

      return true;
    });
  }

  async delete(
    path: string
  ): Promise<void> {
    await this.#database.delete("files", normalizeAssetPath(path));
  }

  isIgnored(
    path: string
  ): boolean {
    return isStatePath(path);
  }

  async list(): Promise<string[]> {
    const files = await this.#database.getAllKeys("files");

    return files.filter((path) => !this.isIgnored(path));
  }

  async folders(): Promise<string[]> {
    const folders = await this.#database.getAllKeys("folders");

    return folders
      .filter((path) => !this.isIgnored(path))
      .sort();
  }

  async createFolder(
    path: string
  ): Promise<void> {
    const folders = new FolderSet().add(
      normalizeAssetPath(path)
    );

    await this.#write(
      (transaction) => this.#putFolders(transaction, folders)
    );
  }

  async deleteFolder(
    path: string
  ): Promise<void> {
    const root = normalizeAssetPath(path);

    await this.#write(async(transaction) => {
      const folders = transaction.objectStore("folders");
      const [files, stored] = await Promise.all([
        transaction.objectStore("files").getAllKeys(),
        folders.getAllKeys()
      ]);
      const pruned = new FolderSet(stored).prune(root, files);

      await Promise.all(
        pruned.map((folder) => folders.delete(folder))
      );
    });
  }

  close(): void {
    this.#database.close();
  }

  async #write<TResult>(
    operation: (transaction: AssetTransaction) => Promise<TResult>
  ): Promise<TResult> {
    const transaction = this.#database.transaction(kStoreNames, "readwrite");
    const [result] = await Promise.all([
      operation(transaction),
      transaction.done
    ]);

    return result;
  }

  async #putFile(
    transaction: AssetTransaction,
    key: string,
    data: Uint8Array
  ): Promise<void> {
    await Promise.all([
      transaction.objectStore("files").put(data, key),
      this.#putFolders(transaction, new FolderSet().addParents(key))
    ]);
  }

  async #putFolders(
    transaction: AssetTransaction,
    folders: FolderSet
  ): Promise<void> {
    const store = transaction.objectStore("folders");

    await Promise.all(
      Array.from(folders, (folder) => store.put(true, folder))
    );
  }
}
