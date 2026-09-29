// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { Vector3Like } from "three";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type {
  LayerRef,
  SelectionStore
} from "../../state/index.ts";
import { createObjectAt } from "./objects/objectArea.ts";
import type { AddLayerResult } from "./AddLayerDialog.ts";
import type { MergeLayerContext } from "./MergeLayerDialog.ts";
import {
  mergeTargetsFor,
  mergeWarnings
} from "./mergeTargets.ts";

export function renameLayerEntry(
  world: VoxelWorld,
  ref: LayerRef,
  name: string
): void {
  if (ref.kind !== "object") {
    return;
  }

  world.objectLayers.updateObject(
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

  world.objectLayers.updateObject(
    ref.layerName,
    ref.objectId,
    { locked }
  );
}

export function createLayerEntry(
  world: VoxelWorld,
  selection: SelectionStore,
  focus: Vector3Like,
  result: AddLayerResult
): void {
  switch (result.kind) {
    case "voxel-layer":
      world.addLayer(result.name);
      selection.selectVoxelLayer(result.name);
      break;
    case "object-layer":
      world.objectLayers.add(result.name);
      selection.selectObjectLayer(result.name);
      break;
    default:
      createObject(
        world,
        selection,
        focus,
        result.name
      );
      break;
  }
}

export async function removeLayerEntry(
  world: VoxelWorld,
  ref: LayerRef
): Promise<void> {
  if (ref.kind === "object") {
    world.objectLayers.removeObject(
      ref.layerName,
      ref.objectId
    );

    return;
  }

  const confirmed = await showConfirm({
    title: "Delete layer",
    message: removalMessage(world, ref),
    confirmLabel: "Delete",
    icon: "trash",
    danger: true
  });
  if (!confirmed) {
    return;
  }

  if (ref.kind === "object-layer") {
    world.objectLayers.remove(ref.name);
  }
  else {
    world.removeLayer(ref.name);
  }
}

export function cloneLayerEntry(
  world: VoxelWorld,
  selection: SelectionStore,
  ref: LayerRef
): void {
  if (ref.kind !== "voxel-layer") {
    return;
  }

  const clone = world.cloneLayer(ref.name);
  if (clone === undefined) {
    return;
  }

  selection.selectVoxelLayer(clone.name);
}

export async function mergeLayerEntry(
  world: VoxelWorld,
  selection: SelectionStore,
  ref: LayerRef,
  pickTarget: (context: MergeLayerContext) => Promise<string | null>
): Promise<void> {
  if (ref.kind !== "voxel-layer") {
    return;
  }

  const { options, defaultTarget } = mergeTargetsFor(world, ref.name);
  if (defaultTarget === null) {
    return;
  }

  const target = await pickTarget({
    sourceName: ref.name,
    options,
    defaultTarget
  });
  if (target === null) {
    return;
  }

  const warnings = mergeWarnings(world, ref.name);
  if (warnings.length > 0) {
    const confirmed = await showConfirm({
      title: "Merge layer",
      message: [
        `Merge "${ref.name}" into "${target}"?`,
        ...warnings
      ].join(" "),
      confirmLabel: "Merge",
      icon: "merge",
      intent: "warning"
    });
    if (!confirmed) {
      return;
    }
  }

  if (world.mergeLayer(ref.name, target)) {
    selection.selectVoxelLayer(target);
  }
}

function createObject(
  world: VoxelWorld,
  selection: SelectionStore,
  focus: Vector3Like,
  name: string
): void {
  const layerName = selection.objectLayer;
  if (layerName === null) {
    return;
  }

  const object = createObjectAt(
    name,
    focus
  );
  world.objectLayers.addObject(
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

  const count = world.objectLayers.get(
    ref.name
  )?.objects.length ?? 0;

  return count === 0 ?
    `Delete the object layer "${ref.name}"?` :
    `Delete the object layer "${ref.name}" and its ${count} object(s)?`;
}
