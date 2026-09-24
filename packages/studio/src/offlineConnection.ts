// Import Third-party Dependencies
import {
  offlineWorkspaceQuery,
  openCatalog
} from "@jolly-pixel/editor.host";
import { openSharedTabWorkspace } from "@jolly-pixel/editor.host/offline";

// Import Internal Dependencies
import type { StudioConnection } from "./connection.ts";
import { loadStudioProject } from "./seed.ts";

// CONSTANTS
const kWorkspace = "studio";

export async function connectOffline(): Promise<StudioConnection> {
  const workspace = await openSharedTabWorkspace({
    ...await loadStudioProject(),
    name: kWorkspace
  });

  return {
    catalog: await openCatalog(workspace.connect().client),
    editorQuery: offlineWorkspaceQuery(kWorkspace)
  };
}
