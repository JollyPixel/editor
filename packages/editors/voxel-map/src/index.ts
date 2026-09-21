// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
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
  const { openOfflineWorkspace } = await import("./boot/offlineWorkspace.ts");
  const workspace = await openOfflineWorkspace();

  return {
    sources: workspace.launchSources(VoxelMapEditor.accepts),
    connect: () => workspace.connect()
  };
}

await mountStandalone(VoxelMapEditor, {
  ...(VOXEL_MAP_PARAMS.read().offline ? await offlineOptions() : {}),
  debugHandle: kDebugHandle
});
