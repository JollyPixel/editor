// Import Third-party Dependencies
import {
  IndexedDbAssetSource,
  MemoryAssetSource,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { OfflineStorage } from "./OfflineWorkspace.ts";
import { acquireWorkspaceLock } from "./workspaceLock.ts";

export interface OfflineSource {
  source: AssetSource;
  storage: OfflineStorage;
  release?: () => void;
}

export async function openOfflineSource(
  requested: OfflineStorage,
  databaseName: string
): Promise<OfflineSource> {
  const release = requested === "indexeddb" ?
    await acquireWorkspaceLock(databaseName) :
    null;
  if (release !== null) {
    return openPersistentSource(databaseName, release);
  }

  return {
    source: new MemoryAssetSource(),
    storage: "memory"
  };
}

export async function openPersistentSource(
  databaseName: string,
  release: () => void
): Promise<OfflineSource> {
  void globalThis.navigator?.storage?.persist?.().catch(
    () => false
  );

  try {
    return {
      source: await IndexedDbAssetSource.open({
        name: databaseName
      }),
      storage: "indexeddb",
      release
    };
  }
  catch (error) {
    release();

    throw error;
  }
}
