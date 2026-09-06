// Import Third-party Dependencies
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";
import type { JollyReparentDetail } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  layerRefOf,
  type LayerRef
} from "./layerTree.ts";

export function canDropLayerRef(
  detail: JollyReparentDetail
): boolean {
  const target = layerRefOf(detail.targetId);

  return detail.movedIds.every(
    (movedId) => allows(layerRefOf(movedId), target, detail.where)
  );
}

export function voxelLayerDropIndex(
  stack: readonly string[],
  movedName: string,
  targetName: string,
  where: "above" | "below"
): number {
  const fromIndex = stack.indexOf(movedName);
  const targetIndex = stack.indexOf(targetName);
  if (fromIndex === -1 || targetIndex === -1) {
    return -1;
  }

  const insertAt = where === "above" ? targetIndex : targetIndex + 1;

  return fromIndex < insertAt ? insertAt - 1 : insertAt;
}

function allows(
  moved: LayerRef,
  target: LayerRef,
  where: JollyReparentDetail["where"]
): boolean {
  if (moved.kind === "voxel-layer") {
    return target.kind === "voxel-layer" && where !== "inside";
  }

  if (moved.kind === "object") {
    return target.kind === "object-layer" &&
      where === "inside" &&
      target.name !== moved.layerName;
  }

  return false;
}

export function applyLayerReparent(
  world: VoxelWorld,
  detail: JollyReparentDetail
): void {
  if (!canDropLayerRef(detail)) {
    return;
  }

  const target = layerRefOf(detail.targetId);
  for (const movedId of detail.movedIds) {
    const moved = layerRefOf(movedId);
    if (moved.kind === "voxel-layer" && target.kind === "voxel-layer") {
      moveVoxelLayerOnto(world, moved.name, target.name, detail.where);
    }
    else if (moved.kind === "object" && target.kind === "object-layer") {
      moveObjectToLayer(world, moved, target.name);
    }
  }
}

function moveVoxelLayerOnto(
  world: VoxelWorld,
  movedName: string,
  targetName: string,
  where: JollyReparentDetail["where"]
): void {
  if (where === "inside") {
    return;
  }

  const stack = world.getLayers().map((layer) => layer.name);
  const toIndex = voxelLayerDropIndex(
    stack,
    movedName,
    targetName,
    where
  );
  if (toIndex === -1) {
    return;
  }

  world.moveLayerTo(movedName, toIndex);
}

function moveObjectToLayer(
  world: VoxelWorld,
  moved: Extract<LayerRef, { kind: "object"; }>,
  targetLayerName: string
): void {
  const object = world
    .getObjectLayer(moved.layerName)
    ?.objects
    .find((candidate) => candidate.id === moved.objectId);
  if (object === undefined) {
    return;
  }

  world.removeObjectFromLayer(moved.layerName, moved.objectId);
  world.addObjectToLayer(targetLayerName, object);
}
