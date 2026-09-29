// Import Third-party Dependencies
import type { MetricsPanel } from "@jolly-pixel/runtime";
import type {
  VoxelView,
  VoxelInspectorMode
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kDebugModeOptions: Record<VoxelInspectorMode, VoxelInspectorMode> = {
  off: "off",
  overlay: "overlay",
  wireframe: "wireframe"
};

export interface InspectorControlsOptions {
  panel: MetricsPanel;
  view: VoxelView;
}

export function mountInspectorControls(
  options: InspectorControlsOptions
): () => void {
  const { panel, view } = options;
  const { inspector } = view;

  const state = {
    mode: inspector.mode,
    chunkBounds: inspector.chunkBounds
  };
  const folder = panel.container.addFolder({ title: "inspector" });
  folder
    .addBinding(state, "mode", {
      options: kDebugModeOptions,
      label: "debug"
    })
    .on("change", ({ value }) => {
      inspector.mode = value;
    });
  folder
    .addBinding(state, "chunkBounds", { label: "chunk bounds" })
    .on("change", ({ value }) => {
      inspector.chunkBounds = value;
    });

  return () => folder.dispose();
}
