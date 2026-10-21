// Import Third-party Dependencies
import {
  VoxelLayerVisibility,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import type { CameraPose } from "@jolly-pixel/engine";
import {
  LogQueue,
  type PresencePeer
} from "@jolly-pixel/ui";
import type { Box3 } from "three";

// Import Internal Dependencies
import {
  TemplateEditing,
  type TemplateEditCamera
} from "../../src/features/templates/editing/TemplateEditing.ts";
import { TemplateDraftId } from "../../src/map/TemplateDraftId.ts";
import { LocalLayerVisibility } from "../../src/features/layers/LocalLayerVisibility.ts";
import { LayerVisibilityStore } from "../../src/features/layers/LayerVisibilityStore.ts";
import { MapLayers } from "../../src/features/layers/MapLayers.ts";
import { MapHistory } from "../../src/features/placement/MapHistory.ts";
import {
  EditContext,
  PresenceStore,
  SelectionStore
} from "../../src/state/index.ts";
import { createEditorMap } from "./editorMap.ts";
import { createWorldHistory } from "./mapHistory.ts";
import { mapAccess } from "./mapAccess.ts";

// CONSTANTS
export const DRAFT_LAYER = new TemplateDraftId("house").layerId;
export const MAP_POSE: CameraPose = {
  position: { x: 4, y: 8, z: 12 },
  quaternion: { x: 0, y: 0, z: 0, w: 1 }
};

export class RecordingCamera implements TemplateEditCamera {
  framed: Array<Box3 | null> = [];
  teleported: CameraPose[] = [];
  focusExits = 0;

  pose(): CameraPose {
    return MAP_POSE;
  }

  teleport(
    pose: CameraPose
  ): void {
    this.teleported.push(pose);
  }

  frame(
    bounds: Box3 | null
  ): void {
    this.framed.push(bounds);
  }

  exitFocus(): void {
    this.focusExits++;
  }
}

export function templateEditingFixture(
  access = mapAccess()
) {
  const world = new VoxelWorld(4);
  world.addLayer("Ground");
  world.setVoxelBulk("Ground", [
    {
      position: { x: 0, y: 0, z: 0 },
      blockId: 1
    },
    {
      position: { x: 1, y: 0, z: 0 },
      blockId: 2
    }
  ]);
  world.templates.createFromLayer("Ground", {
    id: "house",
    name: "House"
  });

  const editorMap = createEditorMap(world);
  const context = new EditContext();
  const selection = new SelectionStore();
  const layers = new MapLayers({
    world,
    selection,
    editorMap,
    access,
    editContext: context
  });
  const view = new VoxelLayerVisibility();
  const visibility = new LocalLayerVisibility({
    world,
    layers: view,
    editorMap,
    visibility: new LayerVisibilityStore()
  });
  const voxels = createWorldHistory(world);
  const placement = {
    cancel: () => false,
    cancelLift: () => false
  };
  const history = new MapHistory({
    history: voxels,
    placement,
    access,
    context
  });
  const camera = new RecordingCamera();
  const presence = new PresenceStore();
  const log = new LogQueue();
  const editing = new TemplateEditing({
    world,
    context,
    selection,
    editorMap,
    access,
    isolate: (layerName) => visibility.isolate(layerName),
    camera,
    history: voxels,
    placement,
    presence,
    log,
    confirm: () => Promise.resolve(true)
  });

  return {
    world,
    context,
    selection,
    layers,
    view,
    history,
    camera,
    presence,
    log,
    editing
  };
}

export function shownInView(
  world: VoxelWorld,
  view: VoxelLayerVisibility,
  layerId: string
): boolean {
  return view.isVisible(world.getLayerById(layerId)!);
}

export function paintDraft(
  world: VoxelWorld,
  x: number
): void {
  world.setVoxel(world.getLayerById(DRAFT_LAYER)!.name, {
    position: { x, y: 0, z: 0 },
    blockId: 3
  });
}

export function presencePeer(
  clientId: string
): PresencePeer {
  return {
    clientId,
    displayName: clientId,
    color: "#ff0000"
  };
}
