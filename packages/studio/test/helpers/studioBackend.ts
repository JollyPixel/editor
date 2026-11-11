// Import Third-party Dependencies
import { StudioServerSettings } from "@jolly-pixel/server/node";
import {
  listenBackend,
  type ServeBackendOptions,
  type ServedBackend
} from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import {
  openStudioProject,
  studioBackendFiles
} from "../../node/studioFiles.ts";

export async function serveBackend(
  options: ServeBackendOptions = {}
): Promise<ServedBackend> {
  const project = await openStudioProject({
    inMemory: true,
    settings: StudioServerSettings.parse({})
  });

  return listenBackend(project, {
    ...options,
    ...await studioBackendFiles()
  });
}
