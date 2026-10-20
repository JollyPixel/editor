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
import { PeerInvite } from "../offline/peer/PeerInvite.ts";
import { shareLinkConnection } from "./shareLinkConnection.ts";
import type {
  OfflineProject,
  OfflineProjectLoader
} from "../offline/server/OfflineServer.ts";
import type { OfflineBackend } from "../offline/OfflineBackend.ts";

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

  async function mountBackend(
    opening: Promise<OfflineBackend>
  ): Promise<StandaloneMount<THandle>> {
    const backend = await opening;

    return editor.mount({
      ...mountOptions,
      sources: backend.launchSources(definition.accepts),
      connect: () => backend.connect()
    });
  }

  function mountOffline(): Promise<StandaloneMount<THandle>> {
    return mountBackend(
      import("../offline/shared-tab/openOfflineBackend.ts")
        .then(({ openOfflineBackend }) => openOfflineBackend({
          project: offline,
          name: params.offline?.name ?? definition.accepts
        }))
    );
  }

  try {
    const invite = PeerInvite.fromHash(globalThis.location?.hash ?? "");
    if (invite !== undefined) {
      return await mountBackend(
        import("../offline/peer/joinPeerInvite.ts")
          .then(({ joinPeerInvite }) => joinPeerInvite(invite))
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
    if (forceOffline || params.offline !== undefined) {
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
