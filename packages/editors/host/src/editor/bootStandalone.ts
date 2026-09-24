// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import {
  mountStandalone,
  type MountStandaloneOptions
} from "./mountStandalone.ts";
import { withOfflineFallback } from "./offerOffline.ts";
import { HOST_PARAMS } from "../params/HostParams.ts";
import type {
  OfflineWorkspaceOptions
} from "../workspace/offline/OfflineWorkspace.ts";

export type OfflineProject = Pick<
  OfflineWorkspaceOptions,
  "handlers" | "seed"
>;

export interface BootStandaloneOptions extends Omit<
  MountStandaloneOptions, "connect"
> {
  offline: () => OfflineProject | Promise<OfflineProject>;
  forceOffline?: boolean;
}

export async function bootStandalone<
  THandle extends EditorHandle
>(
  definition: EditorDefinition<THandle>,
  options: BootStandaloneOptions
): Promise<THandle> {
  const {
    offline,
    forceOffline = false,
    ...mountOptions
  } = options;
  const params = HOST_PARAMS.read();

  async function mountOffline(): Promise<THandle> {
    const { openSharedTabWorkspace } = await import(
      "../workspace/shared-tab/openSharedTabWorkspace.ts"
    );
    const workspace = await openSharedTabWorkspace({
      ...await offline(),
      name: params.workspace
    });

    return mountStandalone(definition, {
      ...mountOptions,
      sources: await workspace.launchSources(definition.accepts),
      connect: () => workspace.connect()
    });
  }

  if (forceOffline || params.offline) {
    return mountOffline();
  }

  return withOfflineFallback({
    message: "The asset server is unreachable.",
    online: () => mountStandalone(definition, mountOptions),
    offline: mountOffline
  });
}
