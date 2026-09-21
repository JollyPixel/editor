// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  EditorLaunch,
  mountStandalone,
  type MountStandaloneOptions
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  VOXEL_MAP_PARAMS,
  VoxelMapEditor
} from "./boot/VoxelMapEditor.ts";
import "./app/sidebarIcons.ts";

// CONSTANTS
const kDebugHandle = import.meta.env.DEV ? "voxelMapEditor" : undefined;

declare global {
  interface Window {
    voxelMapEditor?: VoxelMapEditor;
  }
}

async function offlineOptions(): Promise<MountStandaloneOptions> {
  const {
    OFFLINE_MAP_ID,
    openOfflineWorkspace
  } = await import("./boot/offlineWorkspace.ts");
  const workspace = await openOfflineWorkspace();

  return {
    sources: [
      {
        read: () => Promise.resolve(EditorLaunch.fromTarget(OFFLINE_MAP_ID))
      }
    ],
    connect: () => workspace.connect()
  };
}

await mountStandalone(VoxelMapEditor, {
  ...(VOXEL_MAP_PARAMS.read().offline ? await offlineOptions() : {}),
  debugHandle: kDebugHandle
});
