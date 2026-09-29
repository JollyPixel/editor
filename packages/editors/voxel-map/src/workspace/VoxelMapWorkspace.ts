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
import type { BlockUsageStore } from "../features/blocks/BlockUsageStore.ts";
import type { BlockRenderSources } from "../features/blocks/blockGeometry.ts";
import type { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import type { LocalBrush } from "../features/painting/LocalBrush.ts";
import type { TemplateStore } from "../features/templates/TemplateStore.ts";
import type { MapTilesets } from "../features/tilesets/MapTilesets.ts";

export interface VoxelMapWorkspace {
  state: EditorState;
  mapDocument: MapDocument;
  usage: BlockUsageStore;
  blockSources: BlockRenderSources;
  templates: TemplateStore;
  layerVisibility: LayerVisibilityStore;
  engine: VoxelView;
  gridRenderer: GridRenderer;
  localBrush: LocalBrush;
  tilesets: MapTilesets;
  archives: EditorArchives;
  focusPoint(): Vector3Like;
  loadWorld(data: VoxelWorldJSON): void;
  teleportToPeer(clientId: string): void;
}
