// Import Third-party Dependencies
import { mountStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import { VoxelModelEditor } from "./VoxelModelEditor.ts";

declare global {
  interface Window {
    voxelModelEditor?: VoxelModelEditor;
  }
}

await mountStandalone(VoxelModelEditor, {
  debugHandle: import.meta.env.DEV ? "voxelModelEditor" : undefined
});
