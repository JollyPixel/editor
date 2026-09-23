// Import Third-party Dependencies
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  EditorDefinition,
  EditorHandle
} from "./EditorDefinition.ts";
import {
  EditorLaunch,
  HostMessageLaunchSource,
  InjectedLaunchSource,
  LastOpenedLaunchSource,
  QueryLaunchSource,
  type LaunchSource
} from "../launch/index.ts";
import {
  EditorSession,
  type EditorSessionClient
} from "../session/EditorSession.ts";
import { rememberQueryUsername } from "../session/rememberQueryUsername.ts";
import type { SessionWorkspace } from "../workspace/SessionWorkspace.ts";

// CONSTANTS
export const EDITOR_STATE_ATTRIBUTE = "data-editor-state";
export const DEBUG_HANDLE = "jollyEditor";

export type EditorState = "booting" | "ready" | "failed";

declare global {
  interface Window {
    jollyEditor?: EditorHandle;
  }
}

export interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  workspace?: SessionWorkspace;
}

export interface MountStandaloneOptions {
  sources?: Iterable<LaunchSource>;
  dev?: boolean;
  debugHandle?: string;
  /**
   * Replaces the username prompt and the WebSocket client, for a back-end
   * that is not the page's asset server.
   */
  connect?: () => StandaloneConnection | Promise<StandaloneConnection>;
}

export async function mountStandalone<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions = {}
): Promise<THandle> {
  markEditorState("booting");
  try {
    const handle = await mountEditor(definition, options);
    markEditorState("ready");

    return handle;
  }
  catch (error) {
    markEditorState("failed");

    throw error;
  }
}

async function mountEditor<THandle extends EditorHandle>(
  definition: EditorDefinition<THandle>,
  options: MountStandaloneOptions
): Promise<THandle> {
  const dev = options.dev === true;
  const launch = await EditorLaunch.read(
    options.sources ?? [
      new HostMessageLaunchSource(),
      new QueryLaunchSource(),
      new InjectedLaunchSource()
    ]
  );
  const target = {
    launch,
    kinds: definition.kinds,
    accepts: definition.accepts
  };

  if (dev) {
    rememberQueryUsername();
  }
  const session = options.connect === undefined ?
    await EditorSession.open({
      ...target,
      identity: definition.identity
    }) :
    await EditorSession.connect({
      ...target,
      ...await options.connect()
    });

  let handle: THandle;
  try {
    handle = await definition.mount({
      launch,
      session,
      shell: launch.shell
    });
  }
  catch (error) {
    session.dispose();

    throw error;
  }

  try {
    await handle.ready;
  }
  catch (error) {
    handle.dispose();

    throw error;
  }

  if (session.workspace !== null) {
    LastOpenedLaunchSource.remember(
      definition.accepts,
      launch.target.value
    );
  }

  if (dev) {
    Object.assign(globalThis, {
      [DEBUG_HANDLE]: handle
    });
    if (options.debugHandle !== undefined) {
      Object.assign(globalThis, {
        [options.debugHandle]: handle
      });
    }
  }

  return handle;
}

function markEditorState(
  state: EditorState
): void {
  document.documentElement.setAttribute(EDITOR_STATE_ATTRIBUTE, state);
}
