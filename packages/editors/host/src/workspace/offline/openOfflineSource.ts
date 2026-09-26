// Import Third-party Dependencies
import {
  IndexedDbAssetSource,
  MemoryAssetSource,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { OfflineStorage } from "./OfflineWorkspace.ts";

export interface OfflineSource {
  source: AssetSource;
  storage: OfflineStorage;
  release?: () => void;
}

export async function openOfflineSource(
  requested: OfflineStorage,
  databaseName: string
): Promise<OfflineSource> {
  if (requested === "memory") {
    return {
      source: new MemoryAssetSource(),
      storage: "memory"
    };
  }

  const release = await acquireTabLock(
    databaseName
  );
  if (release === null) {
    return {
      source: new MemoryAssetSource(),
      storage: "memory"
    };
  }

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

async function acquireTabLock(
  name: string
): Promise<(() => void) | null> {
  const locks = globalThis.navigator?.locks;
  if (locks === undefined) {
    return () => void 0;
  }

  const acquired = Promise.withResolvers<boolean>();
  const released = Promise.withResolvers<void>();
  void locks.request(
    name,
    { ifAvailable: true },
    (lock) => {
      acquired.resolve(lock !== null);

      return lock === null ? undefined : released.promise;
    }
  );

  return await acquired.promise ? released.resolve : null;
}
