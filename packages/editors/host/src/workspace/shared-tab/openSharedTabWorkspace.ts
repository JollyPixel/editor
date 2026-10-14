// Import Internal Dependencies
import type { OfflineProjectLoader } from "../offline/OfflineWorkspace.ts";
import {
  DEFAULT_OFFLINE_WORKSPACE_NAME,
  acquireWorkspaceLock,
  workspaceDatabaseName
} from "../offline/workspaceLock.ts";
import type { StandaloneWorkspace } from "../SessionWorkspace.ts";
import { openRemoteWorkspace } from "./openRemoteWorkspace.ts";

export interface SharedTabWorkspaceOptions {
  project: OfflineProjectLoader;
  name?: string;
}

export async function openSharedTabWorkspace(
  options: SharedTabWorkspaceOptions
): Promise<StandaloneWorkspace> {
  const {
    project,
    name = DEFAULT_OFFLINE_WORKSPACE_NAME
  } = options;
  if (
    globalThis.navigator?.locks === undefined ||
    globalThis.BroadcastChannel === undefined
  ) {
    const { OfflineWorkspace } = await import(
      "../offline/OfflineWorkspace.ts"
    );

    return OfflineWorkspace.open({
      ...await project(),
      name,
      storage: "memory"
    });
  }

  const databaseName = workspaceDatabaseName(name);
  const release = await acquireWorkspaceLock(databaseName);
  if (release === null) {
    return openRemoteWorkspace(name, databaseName);
  }

  const { OwnerWorkspace } = await import("./OwnerWorkspace.ts")
    .catch((error: unknown) => {
      release();

      throw error;
    });

  return OwnerWorkspace.open({
    project,
    name,
    databaseName,
    release
  });
}
