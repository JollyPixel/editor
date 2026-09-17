// Import Third-party Dependencies
import "@jolly-pixel/ui";
import { AssetId } from "@jolly-pixel/asset";

// Import Internal Dependencies
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";
import "./shared/domEvents.ts";
import "./app/sidebarIcons.ts";

declare global {
  interface Window {
    voxelMapEditor?: VoxelMapEditor;
  }
}

const query = new URLSearchParams(location.search);
const world = query.get("world");
const maxFps = query.get("max-fps");

const editor = await VoxelMapEditor.open({
  canvas: "#game-container > canvas",
  offline: query.has("offline"),
  world: world === null ? undefined : new AssetId(world),
  maxFps: maxFps === null ? undefined : Number(maxFps)
});

if (import.meta.env.DEV) {
  window.voxelMapEditor = editor;
}
