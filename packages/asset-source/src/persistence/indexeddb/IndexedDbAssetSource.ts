// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import { AssetPathNotFoundError } from "../../errors/AssetPathNotFoundError.ts";
import {
  FolderSet,
  isStatePath,
  normalizeAssetPath
} from "../../paths/index.ts";
import {
  AssetTransaction,
  type TransactionResult
} from "./AssetTransaction.ts";

// CONSTANTS
const kDatabaseVersion = 2;

export interface IndexedDbAssetSourceOptions {
  name: string;
  factory?: IDBFactory;
}

export class IndexedDbAssetSource implements AssetSource {
  static async open(
    options: IndexedDbAssetSourceOptions
  ): Promise<IndexedDbAssetSource> {
    const {
      name,
      factory = globalThis.indexedDB
    } = options;

    const request = factory.open(
      name,
      kDatabaseVersion
    );
    request.onupgradeneeded = (event) => {
      request.transaction !== null && AssetTransaction.upgrade(
        request.transaction,
        event.oldVersion
      );
    };

    return new IndexedDbAssetSource(
      await settled(request)
    );
  }

  static async destroy(
    options: IndexedDbAssetSourceOptions
  ): Promise<void> {
    const {
      name,
      factory = globalThis.indexedDB
    } = options;

    await settled(
      factory.deleteDatabase(name)
    );
  }

  #database: IDBDatabase;

  constructor(
    database: IDBDatabase
  ) {
    this.#database = database;
  }

  async read(
    path: string
  ): Promise<Uint8Array> {
    const key = normalizeAssetPath(path);
    const data = await this.#transact(
      "readonly",
      (transaction) => transaction.file(key)
    );
    if (data === undefined) {
      throw new AssetPathNotFoundError(key);
    }

    return data;
  }

  async exists(
    path: string
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);

    return this.#transact(
      "readonly",
      (transaction) => transaction.hasFile(key)
    );
  }

  async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    return this.#transact(
      "readwrite",
      (transaction) => transaction.putFile(key, copy)
    );
  }

  async writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    return this.#transact(
      "readwrite",
      (transaction) => transaction.putFileIfAbsent(key, copy)
    );
  }

  async delete(
    path: string
  ): Promise<void> {
    const key = normalizeAssetPath(path);

    return this.#transact(
      "readwrite",
      (transaction) => transaction.deleteFile(key)
    );
  }

  isIgnored(
    path: string
  ): boolean {
    return isStatePath(path);
  }

  async list(): Promise<string[]> {
    const files = await this.#transact(
      "readonly",
      (transaction) => transaction.fileKeys()
    );

    return files.filter((path) => !this.isIgnored(path));
  }

  async folders(): Promise<string[]> {
    const folders = await this.#transact(
      "readonly",
      (transaction) => transaction.folderKeys()
    );

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

    return this.#transact(
      "readwrite",
      (transaction) => transaction.putFolders(folders)
    );
  }

  async deleteFolder(
    path: string
  ): Promise<void> {
    const folder = normalizeAssetPath(path);

    return this.#transact(
      "readwrite",
      (transaction) => transaction.pruneFolders(folder)
    );
  }

  close(): void {
    this.#database.close();
  }

  #transact<TResult>(
    mode: IDBTransactionMode,
    operation: (transaction: AssetTransaction) => TransactionResult<TResult>
  ): Promise<TResult> {
    return AssetTransaction.run(
      this.#database,
      mode,
      operation
    );
  }
}

function settled<TResult>(
  request: IDBRequest<TResult>
): Promise<TResult> {
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<TResult>();

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);

  return promise;
}
