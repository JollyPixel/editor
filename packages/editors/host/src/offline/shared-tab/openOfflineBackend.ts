// Import Internal Dependencies
import type { OfflineProjectLoader } from "../server/OfflineServer.ts";
import {
  DEFAULT_OFFLINE_NAME,
  acquireDatabaseLock,
  offlineDatabaseName
} from "../server/databaseLock.ts";
import type { OfflineBackend } from "../OfflineBackend.ts";
import { joinOfflineOwner } from "./joinOfflineOwner.ts";

export interface OfflineBackendOptions {
  project: OfflineProjectLoader;
  name?: string;
}

export interface JoinOfflineBackendOptions {
  /**
   * @default DEFAULT_OFFLINE_NAME
   */
  name?: string;
  /**
   * Joins rooms with `observer: true` in the peer profile, so collaborator
   * lists leave this page out.
   * @default false
   */
  observer?: boolean;
}

export async function openOfflineBackend(
  options: OfflineBackendOptions
): Promise<OfflineBackend> {
  const {
    project,
    name = DEFAULT_OFFLINE_NAME
  } = options;
  if (
    globalThis.navigator?.locks === undefined ||
    globalThis.BroadcastChannel === undefined
  ) {
    const { OfflineServer } = await import(
      "../server/OfflineServer.ts"
    );

    return OfflineServer.open({
      ...await project(),
      name,
      storage: "memory"
    });
  }

  const databaseName = offlineDatabaseName(name);
  const release = await acquireDatabaseLock(databaseName);
  if (release === null) {
    return joinOfflineOwner(name, databaseName);
  }

  const { OfflineOwner } = await import("./OfflineOwner.ts")
    .catch((error: unknown) => {
      release();

      throw error;
    });

  return OfflineOwner.open({
    project,
    name,
    databaseName,
    release
  });
}

export function joinOfflineBackend(
  options: JoinOfflineBackendOptions = {}
): Promise<OfflineBackend> {
  const {
    name = DEFAULT_OFFLINE_NAME,
    observer = false
  } = options;

  return joinOfflineOwner(name, offlineDatabaseName(name), { observer });
}
