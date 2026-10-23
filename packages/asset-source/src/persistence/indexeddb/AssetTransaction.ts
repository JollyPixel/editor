// Import Internal Dependencies
import { FolderSet } from "../../paths/index.ts";

// CONSTANTS
const kFilesStore = "files";
const kFoldersStore = "folders";
const kStoreNames = [
  kFilesStore,
  kFoldersStore
];

export type TransactionResult<TResult> = () => TResult;

export class AssetTransaction {
  static run<TResult>(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    operation: (transaction: AssetTransaction) => TransactionResult<TResult>
  ): Promise<TResult> {
    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<TResult>();

    const transaction = database.transaction(kStoreNames, mode);
    const result = operation(
      new AssetTransaction(transaction)
    );

    transaction.oncomplete = () => resolve(result());
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);

    return promise;
  }

  static upgrade(
    transaction: IDBTransaction,
    oldVersion: number
  ): void {
    const database = transaction.db;
    for (const name of kStoreNames) {
      if (!database.objectStoreNames.contains(name)) {
        database.createObjectStore(name);
      }
    }
    if (oldVersion === 1) {
      new AssetTransaction(transaction).#backfillFolders();
    }
  }

  #transaction: IDBTransaction;

  constructor(
    transaction: IDBTransaction
  ) {
    this.#transaction = transaction;
  }

  file(
    key: string
  ): TransactionResult<Uint8Array | undefined> {
    const request = this.#files().get(key);

    return () => request.result;
  }

  hasFile(
    key: string
  ): TransactionResult<boolean> {
    const request = this.#files().getKey(key);

    return () => request.result !== undefined;
  }

  fileKeys(): TransactionResult<string[]> {
    const request = this.#files().getAllKeys();

    return () => stringKeys(request.result);
  }

  folderKeys(): TransactionResult<string[]> {
    const request = this.#folders().getAllKeys();

    return () => stringKeys(request.result);
  }

  putFile(
    key: string,
    data: Uint8Array
  ): TransactionResult<void> {
    this.#files().put(data, key);

    return this.putFolders(
      new FolderSet().addParents(key)
    );
  }

  putFileIfAbsent(
    key: string,
    data: Uint8Array
  ): TransactionResult<boolean> {
    let written = false;
    const lookup = this.#files().getKey(key);
    lookup.onsuccess = () => {
      if (lookup.result === undefined) {
        this.putFile(key, data);
        written = true;
      }
    };

    return () => written;
  }

  deleteFile(
    key: string
  ): TransactionResult<void> {
    this.#files().delete(key);

    return () => undefined;
  }

  putFolders(
    folders: FolderSet
  ): TransactionResult<void> {
    const store = this.#folders();
    for (const folder of folders) {
      store.put(true, folder);
    }

    return () => undefined;
  }

  pruneFolders(
    root: string
  ): TransactionResult<void> {
    const files = this.#files().getAllKeys();
    const folders = this.#folders().getAllKeys();
    folders.onsuccess = () => {
      const pruned = new FolderSet(stringKeys(folders.result)).prune(
        root,
        stringKeys(files.result)
      );
      const store = this.#folders();
      for (const folder of pruned) {
        store.delete(folder);
      }
    };

    return () => undefined;
  }

  #backfillFolders(): void {
    const files = this.#files().getAllKeys();
    files.onsuccess = () => {
      const folders = new FolderSet();
      for (const file of stringKeys(files.result)) {
        folders.addParents(file);
      }
      this.putFolders(folders);
    };
  }

  #files(): IDBObjectStore {
    return this.#transaction.objectStore(kFilesStore);
  }

  #folders(): IDBObjectStore {
    return this.#transaction.objectStore(kFoldersStore);
  }
}

function stringKeys(
  keys: IDBValidKey[]
): string[] {
  return keys.filter((key) => typeof key === "string");
}
