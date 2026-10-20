// Import Third-party Dependencies
import { BINARY_KIND } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { EDITOR_STATE_ATTRIBUTE } from "#src/state/EditorState.ts";
import type {
  EditorContext,
  EditorHandle
} from "#src/editor/EditorDefinition.ts";
import type { MountStandaloneOptions } from "#src/editor/mountStandalone.ts";
import { DEBUG_HANDLE } from "#src/editor/StandaloneEditor.ts";
import { EditorLaunch } from "#src/launch/EditorLaunch.ts";
import { OfflineServer } from "#src/offline/server/OfflineServer.ts";
import type { StandaloneConnection } from "#src/editor/StandaloneConnection.ts";

// CONSTANTS
export const ASSET_ID = "debug-target";
export const OTHER_ASSET_ID = "other-target";

export function editorState(): string | null {
  return document.documentElement.getAttribute(EDITOR_STATE_ATTRIBUTE);
}

export function openServer(): Promise<OfflineServer> {
  return OfflineServer.open({
    handlers: [],
    seed: {
      "notes/readme.bin": {
        id: ASSET_ID,
        kind: BINARY_KIND,
        content: () => new Uint8Array([1])
      },
      "notes/other.bin": {
        id: OTHER_ASSET_ID,
        kind: BINARY_KIND,
        content: () => new Uint8Array([2])
      }
    }
  });
}

export function offlineOptions(
  server: OfflineServer
): MountStandaloneOptions {
  return {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(ASSET_ID))
      }
    ],
    connect: () => server.connect()
  };
}

export function trackedConnection(
  server: OfflineServer,
  onDestroy: () => void
): StandaloneConnection {
  const connection = server.connect();
  const { client } = connection;

  return {
    ...connection,
    client: {
      room: (name) => client.room(name),
      destroy: () => {
        onDestroy();
        client.destroy();
      }
    }
  };
}

export function definition(
  mount: (context: EditorContext) => Promise<EditorHandle>
) {
  return {
    accepts: BINARY_KIND,
    identity: { title: "never prompted" },
    kinds: [],
    mount
  };
}

export function resetStandalonePage(): void {
  document.documentElement.removeAttribute(EDITOR_STATE_ATTRIBUTE);
  Reflect.deleteProperty(globalThis, DEBUG_HANDLE);
  Reflect.deleteProperty(globalThis, "hostTestHandle");
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  for (const element of document.querySelectorAll(
    "jolly-console, jolly-editor-loading-bar"
  )) {
    element.remove();
  }
}
