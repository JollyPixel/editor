// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type {
  VoxelEditCommand,
  VoxelLayerCommand
} from "../../commands/types.ts";
import { isAir } from "../../blocks/BlockId.ts";
import { VoxelTransform } from "../../geometry/VoxelTransform.ts";
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelLayerStack } from "../VoxelLayerStack.ts";
import {
  packVoxel,
  VOXEL_ABSENT,
  voxelBlockId,
  voxelTransform,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import type {
  VoxelCellChange,
  VoxelCoord,
  VoxelEditRecorder
} from "../types.ts";
import {
  VoxelEditBatch,
  type VoxelEditWriteOptions
} from "./VoxelEditBatch.ts";
import {
  assertVoxelPatchCells,
  VOXEL_PATCH_STRIDE,
  type VoxelPatchCells
} from "./voxelPatch.ts";

// CONSTANTS
const kUntrackedWrite: VoxelEditWriteOptions = {
  track: false,
  record: false
};

export type VoxelWriteMode =
  | "live"
  | "silent"
  | "replay";

export interface VoxelWriterOptions {
  chunkSize: number;
  layers: VoxelLayerStack;
  publish: (command: VoxelLayerCommand) => void;
}

interface VoxelWrite {
  position: Vector3Like;
  packed: PackedVoxel;
}

type LayerCell = [number, number, number, PackedVoxel];

export class VoxelWriter {
  recorder: VoxelEditRecorder | null = null;

  #chunkSize: number;
  #layers: VoxelLayerStack;
  #publish: (command: VoxelLayerCommand) => void;
  #batch: VoxelEditBatch | null = null;

  constructor(
    options: VoxelWriterOptions
  ) {
    this.#chunkSize = options.chunkSize;
    this.#layers = options.layers;
    this.#publish = options.publish;
  }

  transaction<T>(
    fn: () => T
  ): T {
    if (this.#batch !== null) {
      return fn();
    }

    const batch = new VoxelEditBatch(this.#chunkSize);
    this.#batch = batch;
    try {
      return fn();
    }
    finally {
      this.#batch = null;
      batch.markDirty(this.#layers.toArray());
      this.#flush(batch);
    }
  }

  unrecorded<T>(
    fn: () => T
  ): T {
    const recorder = this.recorder;
    this.recorder = null;
    try {
      return fn();
    }
    finally {
      this.recorder = recorder;
    }
  }

  flush(): void {
    if (this.#batch !== null) {
      this.#flush(this.#batch);
    }
  }

  write(
    layer: VoxelLayer | undefined,
    command: VoxelEditCommand,
    mode: VoxelWriteMode
  ): VoxelEditCommand | null {
    const recorder = mode === "live" ? this.recorder : null;
    const batch = mode === "replay" ? null : this.#batch;
    if (
      command.action === "voxels-patched" &&
      layer !== undefined &&
      batch === null &&
      recorder === null &&
      mode !== "replay"
    ) {
      return this.#patchDirect(layer, command.metadata.cells);
    }

    const writes = writesOf(command, layer);
    if (layer === undefined) {
      if (writes.some(({ packed }) => packed !== VOXEL_ABSENT)) {
        throw new Error(
          `VoxelWorld: layer "${command.layerName}" does not exist.`
        );
      }

      return null;
    }

    if (batch !== null) {
      const options = {
        track: mode !== "silent",
        record: recorder !== null
      };
      for (const { position, packed } of writes) {
        batch.write(layer, position, packed, options);
      }

      return null;
    }

    if (command.action === "voxels-patched") {
      const cells = this.#patchTracked(layer, writes, recorder);

      return cells === null ? null : patched(layer, cells);
    }
    if (command.action === "layer-transformed") {
      return this.#patchTracked(layer, writes, recorder) === null ?
        null :
        command;
    }

    this.#writeNow(layer, writes, recorder);

    return command;
  }

  #writeNow(
    layer: VoxelLayer,
    writes: readonly VoxelWrite[],
    recorder: VoxelEditRecorder | null
  ): void {
    const changes: VoxelCellChange[] = [];
    for (const { position, packed } of writes) {
      const before = recorder === null ?
        packed :
        layer.getPackedVoxelAt(position);
      layer.setPackedVoxelAt(position, packed);
      for (const candidate of this.#layers) {
        candidate.markCellDirty(position);
      }

      if (before !== packed) {
        changes.push({
          layerName: layer.name,
          position: {
            x: position.x,
            y: position.y,
            z: position.z
          },
          before,
          after: packed
        });
      }
    }
    if (changes.length > 0) {
      recorder?.record(changes);
    }
  }

  #patchTracked(
    layer: VoxelLayer,
    writes: readonly VoxelWrite[],
    recorder: VoxelEditRecorder | null
  ): VoxelPatchCells | null {
    const batch = new VoxelEditBatch(this.#chunkSize);
    const options = {
      track: true,
      record: recorder !== null
    };
    for (const { position, packed } of writes) {
      batch.write(layer, position, packed, options);
    }
    batch.markDirty(this.#layers.toArray());

    const [flushed] = batch.drain();
    if (flushed === undefined) {
      return null;
    }
    if (flushed.changes.length > 0) {
      recorder?.record(flushed.changes);
    }

    return flushed.cells;
  }

  #patchDirect(
    layer: VoxelLayer,
    cells: VoxelPatchCells
  ): VoxelEditCommand | null {
    assertVoxelPatchCells(cells);

    const batch = new VoxelEditBatch(this.#chunkSize);
    const position = { x: 0, y: 0, z: 0 };
    let written = 0;
    try {
      for (; written < cells.length; written += VOXEL_PATCH_STRIDE) {
        position.x = cells[written];
        position.y = cells[written + 1];
        position.z = cells[written + 2];
        batch.write(
          layer,
          position,
          packPatchCell(cells, written),
          kUntrackedWrite
        );
      }
    }
    catch (error) {
      if (written > 0) {
        this.#publish(patched(layer, cells.slice(0, written)));
      }

      throw error;
    }
    finally {
      batch.markDirty(this.#layers.toArray());
    }

    return written > 0 ? patched(layer, cells.slice(0, written)) : null;
  }

  #flush(
    batch: VoxelEditBatch
  ): void {
    for (const { layer, cells, changes } of batch.drain()) {
      if (changes.length > 0) {
        this.recorder?.record(changes);
      }
      this.#publish(patched(layer, cells));
    }
  }
}

function patched(
  layer: VoxelLayer,
  cells: VoxelPatchCells
): VoxelEditCommand {
  return {
    action: "voxels-patched",
    layerName: layer.name,
    metadata: { cells }
  };
}

function writesOf(
  command: VoxelEditCommand,
  layer: VoxelLayer | undefined
): VoxelWrite[] {
  switch (command.action) {
    case "voxel-set":
      return [
        {
          position: command.metadata.position,
          packed: packVoxel(
            command.metadata.blockId,
            VoxelTransform.pack(command.metadata)
          )
        }
      ];
    case "voxel-removed":
      return [
        {
          position: command.metadata.position,
          packed: VOXEL_ABSENT
        }
      ];
    case "voxels-set":
      return command.metadata.entries.map((entry) => {
        return {
          position: entry.position,
          packed: packVoxel(entry.blockId, VoxelTransform.pack(entry))
        };
      });
    case "voxels-removed":
      return command.metadata.entries.map(({ position }) => {
        return {
          position,
          packed: VOXEL_ABSENT
        };
      });
    case "voxels-patched":
      return patchWrites(command.metadata.cells);
    case "layer-transformed":
      return layer === undefined ?
        [] :
        transformWrites(
          layer,
          VoxelTransform.fromPacked(VoxelTransform.pack(command.metadata))
        );
    default: {
      const unhandled: never = command;
      throw new Error(
        `VoxelWriter: unhandled action '${(unhandled as VoxelEditCommand).action}'.`
      );
    }
  }
}

function patchWrites(
  cells: VoxelPatchCells
): VoxelWrite[] {
  assertVoxelPatchCells(cells);

  const writes: VoxelWrite[] = [];
  for (let index = 0; index < cells.length; index += VOXEL_PATCH_STRIDE) {
    writes.push({
      position: {
        x: cells[index],
        y: cells[index + 1],
        z: cells[index + 2]
      },
      packed: packPatchCell(cells, index)
    });
  }

  return writes;
}

function transformWrites(
  layer: VoxelLayer,
  transform: VoxelTransform
): VoxelWrite[] {
  if (transform.equals(VoxelTransform.Identity)) {
    return [];
  }

  const { x: ox, y: oy, z: oz } = layer.position;
  const cells = Array.from(
    layer.localVoxels(),
    ([x, y, z, packed]): LayerCell => [x + ox, y + oy, z + oz, packed]
  );
  if (cells.length === 0) {
    return [];
  }

  const pivot = transformPivot(cells);
  const targets = new Set<string>();
  const writes: VoxelWrite[] = [];
  for (const [x, y, z, packed] of cells) {
    const offset = transform.transformOffset({
      x: (2 * x) + 1 - pivot.x,
      y: (2 * y) + 1 - pivot.y,
      z: (2 * z) + 1 - pivot.z
    });
    const turned = VoxelTransform
      .fromPacked(voxelTransform(packed))
      .followedBy(transform);
    const position = {
      x: (pivot.x + offset.x - 1) / 2,
      y: (pivot.y + offset.y - 1) / 2,
      z: (pivot.z + offset.z - 1) / 2
    };

    targets.add(`${position.x},${position.y},${position.z}`);
    writes.push({
      position,
      packed: packVoxel(voxelBlockId(packed), turned.packed)
    });
  }
  for (const [x, y, z] of cells) {
    if (!targets.has(`${x},${y},${z}`)) {
      writes.push({
        position: { x, y, z },
        packed: VOXEL_ABSENT
      });
    }
  }

  return writes;
}

function transformPivot(
  cells: readonly LayerCell[]
): VoxelCoord {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const cell of cells) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], cell[axis]);
      max[axis] = Math.max(max[axis], cell[axis]);
    }
  }

  const x = min[0] + max[0] + 1;
  const y = min[1] + max[1] + 1;
  const z = min[2] + max[2] + 1;
  if (((x + z) & 1) === 0) {
    return { x, y, z };
  }

  const step = ((x + z) & 3) === 3 ? 1 : -1;

  return ((x + z) & 3) === ((x - z) & 3) ?
    { x: x + step, y, z } :
    { x, y, z: z + step };
}

function packPatchCell(
  cells: readonly number[],
  index: number
): PackedVoxel {
  const blockId = cells[index + 3];

  return isAir(blockId) ?
    VOXEL_ABSENT :
    packVoxel(blockId, cells[index + 4]);
}
