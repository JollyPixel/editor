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
import { PeerInvite } from "../workspace/peer/PeerInvite.ts";
import { shareLinkConnection } from "../workspace/shareLinkConnection.ts";
import type {
  OfflineProject,
  OfflineProjectLoader
} from "../workspace/offline/OfflineWorkspace.ts";
import type { StandaloneWorkspace } from "../workspace/SessionWorkspace.ts";

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

  async function mountWorkspace(
    opening: Promise<StandaloneWorkspace>
  ): Promise<StandaloneMount<THandle>> {
    const workspace = await opening;

    return editor.mount({
      ...mountOptions,
      sources: workspace.launchSources(definition.accepts),
      connect: () => workspace.connect()
    });
  }

  function mountOffline(): Promise<StandaloneMount<THandle>> {
    return mountWorkspace(
      import("../workspace/shared-tab/openSharedTabWorkspace.ts")
        .then(({ openSharedTabWorkspace }) => openSharedTabWorkspace({
          project: offline,
          name: params.workspace ?? definition.accepts
        }))
    );
  }

  try {
    const invite = PeerInvite.fromHash(globalThis.location?.hash ?? "");
    if (invite !== undefined) {
      return await mountWorkspace(
        import("../workspace/peer/openPeerWorkspace.ts")
          .then(({ openPeerWorkspace }) => openPeerWorkspace(invite))
      );
    }

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
