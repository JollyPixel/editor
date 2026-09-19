// Import Third-party Dependencies
import "@jolly-pixel/ui";
import {
  exposeDebugHandle,
  mountStandalone
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  VOXEL_MAP_DEV_OPTIONS,
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

const dev = VOXEL_MAP_DEV_OPTIONS.read();
if (dev.offline) {
  const editor = await VoxelMapEditor.openOffline(dev);
  if (kDebugHandle !== undefined) {
    exposeDebugHandle(kDebugHandle, editor);
  }
}
else {
  await mountStandalone(VoxelMapEditor, {
    debugHandle: kDebugHandle
  });
}
