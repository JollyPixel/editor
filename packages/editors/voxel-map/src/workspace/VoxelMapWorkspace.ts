// Import Third-party Dependencies
import type {
  VoxelView,
  VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";
import type { EditorArchives } from "@jolly-pixel/editor.host";
import type {
  Box3,
  Vector3Like
} from "three";

// Import Internal Dependencies
import type { EditorMap } from "../map/EditorMap.ts";
import type { EditorState } from "../state/index.ts";
import type { BlockUsageStore } from "../features/blocks/usage/BlockUsageStore.ts";
import type { BlockRenderSources } from "../features/blocks/rendering/BlockRenderSources.ts";
import type { PreviewStage } from "../features/preview/PreviewStage.ts";
import type { LayerVisibilityStore } from "../features/layers/LayerVisibilityStore.ts";
import type { MapLayers } from "../features/layers/MapLayers.ts";
import type { LocalBrush } from "../features/painting/LocalBrush.ts";
import type { MapHistory } from "../features/placement/MapHistory.ts";
import type { MapPlacement } from "../features/placement/MapPlacement.ts";
import type { MapTemplates } from "../features/templates/MapTemplates.ts";
import type { TemplateEditing } from "../features/templates/editing/TemplateEditing.ts";
import type { MapBlocksets } from "../features/blocksets/MapBlocksets.ts";
import type { MapMaterials } from "../features/materials/MapMaterials.ts";
import type { MapGrants } from "../access/MapAccess.ts";

export interface VoxelMapWorkspace {
  state: EditorState;
  access: MapGrants;
  editorMap: EditorMap;
  usage: BlockUsageStore;
  blockSources: BlockRenderSources;
  previewStage: PreviewStage;
  templates: MapTemplates;
  templateEditing: TemplateEditing;
  placement: MapPlacement;
  history: MapHistory;
  layerVisibility: LayerVisibilityStore;
  layers: MapLayers;
  view: VoxelView;
  localBrush: LocalBrush;
  blocksets: MapBlocksets;
  materials: MapMaterials;
  archives: EditorArchives;
  focusPoint(): Vector3Like;
  pointAt(
    clientX: number,
    clientY: number
  ): Vector3Like | null;
  loadWorld(data: VoxelWorldJSON): void;
  teleportToPeer(clientId: string): void;
  frame(bounds: Box3): void;
}
