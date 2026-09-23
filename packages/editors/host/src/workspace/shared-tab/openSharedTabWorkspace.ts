// Import Internal Dependencies
import {
  OfflineWorkspace,
  type OfflineWorkspaceOptions
} from "../offline/OfflineWorkspace.ts";
import type { StandaloneWorkspace } from "../SessionWorkspace.ts";
import { OwnerWorkspace } from "./OwnerWorkspace.ts";
import { RemoteWorkspace } from "./RemoteWorkspace.ts";

export async function openSharedTabWorkspace(
  options: OfflineWorkspaceOptions
): Promise<StandaloneWorkspace> {
  if (
    globalThis.navigator?.locks === undefined ||
    globalThis.BroadcastChannel === undefined
  ) {
    return OfflineWorkspace.open({
      ...options,
      storage: "memory"
    });
  }

  const name = options.name ?? "default";
  const workspace = await OfflineWorkspace.open({
    ...options,
    storage: "indexeddb"
  });
  if (workspace.persistent) {
    try {
      return new OwnerWorkspace(workspace, name);
    }
    catch (error) {
      await workspace.close();

      throw error;
    }
  }
  await workspace.close();

  return RemoteWorkspace.open(name);
}
