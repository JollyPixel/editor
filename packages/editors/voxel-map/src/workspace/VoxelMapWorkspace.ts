// Import Third-party Dependencies
import type {
  VoxelView,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type { EditorArchives } from "@jolly-pixel/editor.host";
import type { Grid } from "@jolly-pixel/three";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { MapDocument } from "../document/MapDocument.ts";
import type { EditorState } from "../state/index.ts";
import type { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import type { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import type { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import type { MapLayers } from "../features/layers/MapLayers.ts";
import type { BrushStore } from "../features/painting/BrushStore.ts";
import type { LocalBrush } from "../features/painting/LocalBrush.ts";
import type { MapPlacement } from "../features/placement/MapPlacement.ts";
import type { MapTemplates } from "../features/templates/MapTemplates.ts";
import type { MapBlocksets } from "../features/blocksets/MapBlocksets.ts";

export interface VoxelMapWorkspace {
  state: EditorState;
  brush: BrushStore;
  mapDocument: MapDocument;
  usage: BlockUsageStore;
  blockSources: BlockRenderSources;
  templates: MapTemplates;
  placement: MapPlacement;
  layerVisibility: LayerVisibilityStore;
  layers: MapLayers;
  view: VoxelView;
  grid: Grid;
  localBrush: LocalBrush;
  blocksets: MapBlocksets;
  archives: EditorArchives;
  focusPoint(): Vector3Like;
  pointAt(
    clientX: number,
    clientY: number
  ): Vector3Like | null;
  loadWorld(data: VoxelWorldJSON): void;
  teleportToPeer(clientId: string): void;
}
