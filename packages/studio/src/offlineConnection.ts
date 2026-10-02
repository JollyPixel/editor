// Import Third-party Dependencies
import {
  offlineWorkspaceQuery,
  openCatalog
} from "@jolly-pixel/editor.host";
import { openSharedTabWorkspace } from "@jolly-pixel/editor.host/offline";
import createHandlers from "virtual:jolly-pixel/handlers";

// Import Internal Dependencies
import type { StudioConnection } from "./connection.ts";
import { loadStudioSeed } from "./seed.ts";

// CONSTANTS
const kWorkspace = "studio";

export async function connectOffline(): Promise<StudioConnection> {
  const workspace = await openSharedTabWorkspace({
    project: async() => {
      return {
        handlers: createHandlers(),
        seed: await loadStudioSeed()
      };
    },
    name: kWorkspace
  });

  return {
    catalog: await openCatalog(workspace.connect().client),
    editorQuery: offlineWorkspaceQuery(kWorkspace)
  };
}
