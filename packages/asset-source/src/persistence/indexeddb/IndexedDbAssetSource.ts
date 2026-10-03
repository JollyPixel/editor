// Import Internal Dependencies
import type { AssetSource } from "../../AssetSource.ts";
import {
  FolderSet,
  isStatePath,
  normalizeAssetPath
} from "../../paths/index.ts";

// CONSTANTS
const kDatabaseVersion = 2;
const kFilesStore = "files";
const kFoldersStore = "folders";
const kStores = [kFilesStore, kFoldersStore];

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
      const database = request.result;
      for (const store of kStores) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store);
        }
      }
      if (event.oldVersion === 1 && request.transaction !== null) {
        backfillFolders(request.transaction);
      }
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
    const copy = Uint8Array.from(data);
    await this.#update(
      (transaction) => storeFile(transaction, key, copy)
    );
  }

  async writeIfAbsent(
    path: string,
    data: Uint8Array
  ): Promise<boolean> {
    const key = normalizeAssetPath(path);
    const copy = Uint8Array.from(data);

    let written = false;
    await this.#update((transaction) => {
      const lookup = transaction.objectStore(kFilesStore).getKey(key);
      lookup.onsuccess = () => {
        if (lookup.result === undefined) {
          storeFile(transaction, key, copy);
          written = true;
        }
      };
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

    return stringKeys(keys)
      .filter((path) => !isStatePath(path));
  }

  async folders(): Promise<string[]> {
    const keys = await this.#run(
      "readonly",
      (store) => store.getAllKeys(),
      kFoldersStore
    );

    return stringKeys(keys)
      .filter((path) => !isStatePath(path))
      .sort();
  }

  async createFolder(
    path: string
  ): Promise<void> {
    const folders = new FolderSet().add(
      normalizeAssetPath(path)
    );
    await this.#update(
      (transaction) => storeFolders(transaction, folders)
    );
  }

  async deleteFolder(
    path: string
  ): Promise<void> {
    const folder = normalizeAssetPath(path);
    await this.#update((transaction) => {
      const files = transaction.objectStore(kFilesStore).getAllKeys();
      const store = transaction.objectStore(kFoldersStore);
      const folders = store.getAllKeys();
      folders.onsuccess = () => {
        const pruned = new FolderSet(stringKeys(folders.result)).prune(
          folder,
          stringKeys(files.result)
        );
        for (const removed of pruned) {
          store.delete(removed);
        }
      };
    });
  }

  close(): void {
    this.#database.close();
  }

  #run<TResult>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<TResult>,
    storeName = kFilesStore
  ): Promise<TResult> {
    return this.#transact(mode, (transaction) => {
      const request = operation(
        transaction.objectStore(storeName)
      );

      return () => request.result;
    });
  }

  #update(
    operation: (transaction: IDBTransaction) => void
  ): Promise<void> {
    return this.#transact("readwrite", (transaction) => {
      operation(transaction);

      return () => undefined;
    });
  }

  #transact<TResult>(
    mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => () => TResult
  ): Promise<TResult> {
    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<TResult>();

    const transaction = this.#database.transaction(
      kStores,
      mode
    );
    const result = operation(transaction);

    transaction.oncomplete = () => resolve(result());
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);

    return promise;
  }
}

function storeFile(
  transaction: IDBTransaction,
  key: string,
  data: Uint8Array
): void {
  transaction.objectStore(kFilesStore).put(data, key);
  storeFolders(
    transaction,
    new FolderSet().addParentsOf(key)
  );
}

function storeFolders(
  transaction: IDBTransaction,
  folders: FolderSet
): void {
  const store = transaction.objectStore(kFoldersStore);
  for (const folder of folders) {
    store.put(true, folder);
  }
}

function backfillFolders(
  transaction: IDBTransaction
): void {
  const files = transaction.objectStore(kFilesStore).getAllKeys();
  files.onsuccess = () => {
    const folders = new FolderSet();
    for (const file of stringKeys(files.result)) {
      folders.addParentsOf(file);
    }
    storeFolders(transaction, folders);
  };
}

function stringKeys(
  keys: IDBValidKey[]
): string[] {
  return keys.filter((key) => typeof key === "string");
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
