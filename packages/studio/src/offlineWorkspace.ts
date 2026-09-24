// Import Third-party Dependencies
import {
  openSharedTabWorkspace,
  type StandaloneWorkspace
} from "@jolly-pixel/editor.host/offline";

// Import Internal Dependencies
import { createStudioProject } from "./seed.ts";

// CONSTANTS
export const STUDIO_OFFLINE_WORKSPACE = "studio";
const kTilesetUrl = new URL("../vite/seed/tileset.png", import.meta.url);

export async function openStudioOfflineWorkspace(): Promise<StandaloneWorkspace> {
  const response = await fetch(kTilesetUrl);
  if (!response.ok) {
    throw new Error(`Unable to load studio tileset (${response.status}).`);
  }
  const project = await createStudioProject(
    new Uint8Array(await response.arrayBuffer())
  );

  return openSharedTabWorkspace({
    name: STUDIO_OFFLINE_WORKSPACE,
    handlers: project.handlers,
    seed: project.seed
  });
}
