// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { SelectionStore } from "../../app/state/index.ts";
import type { ViewFocus } from "../../scene/viewFocus.ts";
import { createObjectAt } from "./objects/objectArea.ts";
import type { AddLayerResult } from "./AddLayerDialog.ts";
import type { LayerRef } from "./layerTree.ts";

export function setLayerEntryVisibility(
  world: VoxelWorld,
  ref: LayerRef,
  visible: boolean
): void {
  switch (ref.kind) {
    case "object":
      world.updateObjectInLayer(
        ref.layerName,
        ref.objectId,
        { visible }
      );
      break;
    case "object-layer":
      world.updateObjectLayer(
        ref.name,
        { visible }
      );
      break;
    default:
      world.updateLayer(
        ref.name,
        { visible }
      );
      break;
  }
}

export function renameLayerEntry(
  world: VoxelWorld,
  ref: LayerRef,
  name: string
): void {
  if (ref.kind !== "object") {
    return;
  }

  world.updateObjectInLayer(
    ref.layerName,
    ref.objectId,
    { name }
  );
}

export function setLayerEntryLocked(
  world: VoxelWorld,
  ref: LayerRef,
  locked: boolean
): void {
  if (ref.kind !== "object") {
    return;
  }

  world.updateObjectInLayer(
    ref.layerName,
    ref.objectId,
    { locked }
  );
}

export function createLayerEntry(
  world: VoxelWorld,
  selection: SelectionStore,
  viewFocus: ViewFocus,
  result: AddLayerResult
): void {
  switch (result.kind) {
    case "voxel-layer":
      world.addLayer(result.name);
      selection.selectVoxelLayer(result.name);
      break;
    case "object-layer":
      world.addObjectLayer(result.name);
      selection.selectObjectLayer(result.name);
      break;
    default:
      createObject(
        world,
        selection,
        viewFocus,
        result.name
      );
      break;
  }
}

export async function removeLayerEntry(
  world: VoxelWorld,
  selection: SelectionStore,
  ref: LayerRef
): Promise<void> {
  if (ref.kind === "object") {
    world.removeObjectFromLayer(
      ref.layerName,
      ref.objectId
    );
    selection.selectObjectLayer(ref.layerName);

    return;
  }

  const confirmed = await showConfirm({
    title: "Delete layer",
    message: removalMessage(world, ref),
    confirmLabel: "Delete",
    danger: true
  });
  if (!confirmed) {
    return;
  }

  if (ref.kind === "object-layer") {
    world.removeObjectLayer(ref.name);
  }
  else {
    world.removeLayer(ref.name);
  }
  selection.clear();
}

export function moveLayerEntry(
  world: VoxelWorld,
  ref: LayerRef,
  direction: "up" | "down"
): void {
  if (ref.kind === "voxel-layer") {
    world.moveLayer(
      ref.name,
      direction
    );
  }
}

function createObject(
  world: VoxelWorld,
  selection: SelectionStore,
  viewFocus: ViewFocus,
  name: string
): void {
  const layerName = selection.objectLayer;
  if (layerName === null) {
    return;
  }

  const object = createObjectAt(
    name,
    viewFocus.point
  );
  world.addObjectToLayer(
    layerName,
    object
  );
  selection.selectObject({
    layerName,
    objectId: object.id
  });
}

function removalMessage(
  world: VoxelWorld,
  ref: Exclude<LayerRef, { kind: "object"; }>
): string {
  if (ref.kind === "voxel-layer") {
    return `Delete the voxel layer "${ref.name}" and everything painted on it?`;
  }

  const count = world.getObjectLayer(
    ref.name
  )?.objects.length ?? 0;

  return count === 0 ?
    `Delete the object layer "${ref.name}"?` :
    `Delete the object layer "${ref.name}" and its ${count} object(s)?`;
}
