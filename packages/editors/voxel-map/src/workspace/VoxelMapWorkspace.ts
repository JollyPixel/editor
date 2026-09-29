// Import Third-party Dependencies
import type {
  VoxelView,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type { EditorArchives } from "@jolly-pixel/editor.host";
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { MapDocument } from "../document/index.ts";
import type { EditorState } from "../state/index.ts";
import type { GridRenderer } from "../scene/GridRenderer.ts";
import type { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import type { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import type { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import type { MapLayers } from "../features/layers/MapLayers.ts";
import type { LocalBrush } from "../features/painting/LocalBrush.ts";
import type { MapPlacement } from "../features/placement/MapPlacement.ts";
import type { MapTemplates } from "../features/templates/MapTemplates.ts";
import type { MapTilesets } from "../features/tilesets/MapTilesets.ts";

export interface VoxelMapWorkspace {
  state: EditorState;
  mapDocument: MapDocument;
  usage: BlockUsageStore;
  blockSources: BlockRenderSources;
  templates: MapTemplates;
  placement: MapPlacement;
  layerVisibility: LayerVisibilityStore;
  layers: MapLayers;
  view: VoxelView;
  gridRenderer: GridRenderer;
  localBrush: LocalBrush;
  tilesets: MapTilesets;
  archives: EditorArchives;
  focusPoint(): Vector3Like;
  pointAt(
    clientX: number,
    clientY: number
  ): Vector3Like | null;
  loadWorld(data: VoxelWorldJSON): void;
  teleportToPeer(clientId: string): void;
}
