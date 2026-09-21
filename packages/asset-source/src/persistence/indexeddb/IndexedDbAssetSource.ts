// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import {
  isStatePath,
  normalizeAssetPath
} from "../../paths.ts";

// CONSTANTS
const kDatabaseVersion = 1;
const kFilesStore = "files";

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
    request.onupgradeneeded = () => {
      request.result.createObjectStore(kFilesStore);
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
    const data = await this.#run<Uint8Array | undefined>(
      "readonly",
      (store) => store.get(key)
    );
    if (data === undefined) {
      throw Object.assign(
        new Error(`ENOENT: no such asset, read "${key}"`),
        { code: "ENOENT" }
      );
    }

    return data;
  }

  async exists(
    path: string
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    const found = await this.#run(
      "readonly",
      (store) => store.getKey(key)
    );

    return found !== undefined;
  }

  async write(
    path: string,
    data: Uint8Array
  ): Promise<void> {
    const key = normalizeAssetPath(path);
    await this.#run(
      "readwrite",
      (store) => store.put(Uint8Array.from(data), key)
    );
  }

  async writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    let written = false;
    await this.#run("readwrite", (store) => {
      const lookup = store.getKey(key);
      lookup.onsuccess = () => {
        if (lookup.result === undefined) {
          store.put(copy, key);
          written = true;
        }
      };

      return lookup;
    });

    return written;
  }

  async delete(
    path: string
  ): Promise<void> {
    const key = normalizeAssetPath(path);
    await this.#run(
      "readwrite",
      (store) => store.delete(key)
    );
  }

  async list(): Promise<string[]> {
    const keys = await this.#run(
      "readonly",
      (store) => store.getAllKeys()
    );

    return keys
      .filter((key) => typeof key === "string")
      .filter((path) => !isStatePath(path));
  }

  close(): void {
    this.#database.close();
  }

  #run<TResult>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<TResult>
  ): Promise<TResult> {
    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<TResult>();

    const transaction = this.#database.transaction(
      kFilesStore,
      mode
    );
    const request = operation(
      transaction.objectStore(kFilesStore)
    );

    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error ?? request.error);

    return promise;
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
