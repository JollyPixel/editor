// Import Third-party Dependencies
import { mountStandalone } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import "./app/paneIcons.ts";
import "./app/LeftPanel.ts";
import "./app/RightPanel.ts";
import { VoxelModelEditor } from "./boot/VoxelModelEditor.ts";

declare global {
  interface Window {
    voxelModelEditor?: VoxelModelEditor;
  }
}

await mountStandalone(VoxelModelEditor, {
  debugHandle: import.meta.env.DEV ? "voxelModelEditor" : undefined
});
