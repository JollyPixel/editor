// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import type {
  MountStandaloneOptions,
  StandaloneMount
} from "./mountStandalone.ts";
import { withOfflineFallback } from "./offerOffline.ts";
import { StandaloneEditor } from "./StandaloneEditor.ts";
import { readDebugLogger } from "../debug/readDebugLogger.ts";
import { InjectedLaunchSource } from "../launch/index.ts";
import { HOST_PARAMS } from "../params/HostParams.ts";
import { shareLinkConnection } from "../workspace/shareLinkConnection.ts";
import type {
  OfflineProject,
  OfflineProjectLoader
} from "../workspace/offline/OfflineWorkspace.ts";

export type { OfflineProject };

export interface BootStandaloneOptions extends Omit<
  MountStandaloneOptions, "connect"
> {
  offline: OfflineProjectLoader;
  forceOffline?: boolean;
}

export async function bootStandalone<
  THandle extends EditorHandle
>(
  definition: EditorDefinition<THandle>,
  options: BootStandaloneOptions
): Promise<StandaloneMount<THandle>> {
  const {
    offline,
    forceOffline = false,
    logger = readDebugLogger(),
    ...mountOptions
  } = options;
  const params = HOST_PARAMS.read();
  const editor = new StandaloneEditor(definition, logger);

  async function mountOffline(): Promise<StandaloneMount<THandle>> {
    const { openSharedTabWorkspace } = await import(
      "../workspace/shared-tab/openSharedTabWorkspace.ts"
    );
    const workspace = await openSharedTabWorkspace({
      project: offline,
      name: params.workspace
    });

    return editor.mount({
      ...mountOptions,
      sources: workspace.launchSources(definition.accepts),
      connect: () => workspace.connect()
    });
  }

  try {
    const injected = new InjectedLaunchSource();
    const credential = (await injected.read())?.credential ?? null;
    if (credential !== null) {
      return await editor.mount({
        ...mountOptions,
        sources: [injected],
        connect: () => shareLinkConnection(credential)
      });
    }
    if (forceOffline || params.offline) {
      return await mountOffline();
    }

    return await withOfflineFallback({
      message: "The asset server is unreachable.",
      online: () => editor.mount(mountOptions),
      offline: mountOffline
    });
  }
  catch (error) {
    editor.dispose();

    throw error;
  }
}
