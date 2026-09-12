// Import Third-party Dependencies
import "@jolly-pixel/ui";

// Import Internal Dependencies
import { VoxelMapEditor } from "./boot/VoxelMapEditor.ts";
import "./shared/domEvents.ts";
import "./app/sidebarIcons.ts";

await VoxelMapEditor.open({
  canvas: "#game-container > canvas",
  offline: new URLSearchParams(location.search).has("offline")
});
