// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelView,
  type VoxelEntry,
  type VoxelPart,
  type VoxelRemoveOptions,
  type VoxelSetOptions
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  canMergePaint,
  type BrushStroke,
  type VoxelPaint
} from "../model/BrushStroke.ts";

export function applyBrushStroke(
  view: VoxelView,
  stroke: BrushStroke,
  centers: Iterable<VoxelCoord>,
  brushSize: number
): boolean {
  const cells: VoxelCoord[] = [];
  for (const position of centers) {
    cells.push(
      ...stroke.claim(stroke.footprintAt(position, brushSize).cells())
    );
  }
  if (cells.length === 0) {
    return false;
  }

  const { world } = view.document;
  const layer = world.getLayer(stroke.layerName);
  if (stroke.paint) {
    const paint = stroke.paint;
    const transform = new VoxelTransform(paint).packed;
    const entries: VoxelSetOptions[] = [];
    const halves: VoxelSetOptions[] = [];
    for (const position of cells) {
      const entry = layer?.getVoxelAt(position);
      const half = stroke.mode === "replace" && entry !== undefined ?
        stroke.aimedHalfAt(position, entry) :
        null;
      const replacement = half?.replacementFor(paint, view.complements);
      if (half && replacement) {
        if (
          replacement.blockId !== half.aimed.blockId ||
          replacement.transform !== half.aimed.transform
        ) {
          halves.push(
            partWrite(position, half.kept),
            { ...partWrite(position, replacement), merge: true }
          );
        }
        continue;
      }

      const merge = stroke.mode === "place" &&
        canMergePaint(view, stroke.layerName, position, paint);
      const writes = stroke.mode === "replace" ?
        entry !== undefined && !paints(entry, paint, transform) :
        entry === undefined || merge;
      if (writes) {
        entries.push({
          position,
          blockId: paint.blockId,
          rotation: paint.rotation,
          flipY: paint.flipY,
          ...(merge ? { merge } : {})
        });
      }
    }
    if (entries.length === 0 && halves.length === 0) {
      return false;
    }

    if (entries.length > 0) {
      world.setVoxelBulk(stroke.layerName, entries);
    }
    if (halves.length > 0) {
      world.transaction(() => world.setVoxelBulk(stroke.layerName, halves));
    }
  }
  else {
    const removals: VoxelRemoveOptions[] = [];
    const survivors: VoxelSetOptions[] = [];
    for (const position of cells) {
      const entry = layer?.getVoxelAt(position);
      if (entry === undefined) {
        continue;
      }

      const survivor = stroke.aimedHalfAt(position, entry)?.kept ?? null;
      if (survivor === null) {
        removals.push({ position });
      }
      else {
        survivors.push(partWrite(position, survivor));
      }
    }
    if (removals.length === 0 && survivors.length === 0) {
      return false;
    }

    if (removals.length > 0) {
      world.removeVoxelBulk(stroke.layerName, removals);
    }
    if (survivors.length > 0) {
      world.setVoxelBulk(stroke.layerName, survivors);
    }
  }

  view.flush();

  return true;
}

function partWrite(
  position: VoxelCoord,
  part: VoxelPart
): VoxelSetOptions {
  const {
    rotation,
    flipX,
    flipZ,
    flipY
  } = VoxelTransform.fromPacked(part.transform);

  return {
    position,
    blockId: part.blockId,
    rotation,
    flipX,
    flipZ,
    flipY
  };
}

function paints(
  entry: VoxelEntry,
  paint: VoxelPaint,
  transform: number
): boolean {
  return entry.partner === undefined &&
    entry.blockId === paint.blockId &&
    entry.transform === transform;
}
