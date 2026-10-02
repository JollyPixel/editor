// CONSTANTS
export const OFFLINE_DATABASE_PREFIX = "jolly-workspace:";
export const DEFAULT_OFFLINE_WORKSPACE_NAME = "default";

export function workspaceDatabaseName(
  name: string
): string {
  return `${OFFLINE_DATABASE_PREFIX}${name}`;
}

export async function acquireWorkspaceLock(
  databaseName: string
): Promise<(() => void) | null> {
  const locks = globalThis.navigator?.locks;
  if (locks === undefined) {
    return () => void 0;
  }

  const acquired = Promise.withResolvers<boolean>();
  const released = Promise.withResolvers<void>();
  void locks.request(
    databaseName,
    { ifAvailable: true },
    (lock) => {
      acquired.resolve(lock !== null);

      return lock === null ? undefined : released.promise;
    }
  );

  return await acquired.promise ? released.resolve : null;
}
