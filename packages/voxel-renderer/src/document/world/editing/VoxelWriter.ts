// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type {
  VoxelEditCommand,
  VoxelLayerCommand
} from "../../commands/types.ts";
import { VoxelTransform } from "../../geometry/VoxelTransform.ts";
import type { VoxelLayer } from "../VoxelLayer.ts";
import type { VoxelLayerStack } from "../VoxelLayerStack.ts";
import {
  packVoxel,
  turnVoxel,
  VOXEL_ABSENT,
  type PackedVoxel
} from "../storage/packedVoxel.ts";
import { isAir } from "../../blocks/BlockId.ts";
import {
  cellPartner,
  cellPrimary,
  sameCell
} from "../storage/mergedVoxel.ts";
import type {
  VoxelCellChange,
  VoxelCoord,
  VoxelEditRecorder
} from "../types.ts";
import {
  VOXEL_REACH_OBSERVERS,
  VOXEL_REACH_RECORDERS,
  VoxelEditBatch,
  type VoxelEditBatchFlush,
  type VoxelEditWriteOptions
} from "./VoxelEditBatch.ts";
import {
  assertVoxelPatch,
  voxelPatch,
  VOXEL_PATCH_PARTNER_STRIDE,
  VOXEL_PATCH_STRIDE,
  type VoxelPatch,
  type VoxelPatchPartners
} from "./voxelPatch.ts";

// CONSTANTS
const kUntrackedWrite: VoxelEditWriteOptions = {
  track: false,
  reach: 0
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
  partner: PackedVoxel;
  merge: boolean;
}

type LayerCell = [number, number, number, PackedVoxel, PackedVoxel];

export class VoxelWriter {
  #recorders = new Set<VoxelEditRecorder>();
  #observers = new Set<VoxelEditRecorder>();
  #suspended = 0;
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

  addRecorder(
    recorder: VoxelEditRecorder,
    includeUnrecorded: boolean
  ): void {
    (includeUnrecorded ? this.#observers : this.#recorders).add(recorder);
  }

  removeRecorder(
    recorder: VoxelEditRecorder
  ): boolean {
    const recorded = this.#recorders.delete(recorder);
    const observed = this.#observers.delete(recorder);

    return recorded || observed;
  }

  unrecorded<T>(
    fn: () => T
  ): T {
    this.#suspended++;
    try {
      return fn();
    }
    finally {
      this.#suspended--;
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
    const reach = this.#computeObserverReach(mode);
    const batch = mode === "replay" ? null : this.#batch;
    if (
      command.action === "voxels-patched" &&
      layer !== undefined &&
      batch === null &&
      reach === 0 &&
      mode !== "replay"
    ) {
      return this.#patchDirect(layer, command.metadata);
    }

    const writes = decodeVoxelWrites(command, layer);
    if (layer === undefined) {
      if (writes.some(({ packed }) => packed !== VOXEL_ABSENT)) {
        throw new Error(
          `VoxelWorld: layer "${command.layerId}" does not exist.`
        );
      }

      return null;
    }

    if (batch !== null) {
      const options = {
        track: mode !== "silent",
        reach
      };
      for (const write of writes) {
        const { position, packed, partner } = resolvedWrite(layer, write);
        batch.write(layer, position, packed, partner, options);
      }

      return null;
    }

    if (command.action === "voxels-patched") {
      const flushed = this.#patchTracked(layer, writes, reach);

      return flushed === null ?
        null :
        patched(layer.id, voxelPatch(flushed.cells, flushed.partners));
    }
    if (command.action === "layer-transformed") {
      return this.#patchTracked(layer, writes, reach) === null ?
        null :
        command;
    }

    this.#writeNow(layer, writes, reach);

    return command;
  }

  #writeNow(
    layer: VoxelLayer,
    writes: readonly VoxelWrite[],
    reach: number
  ): void {
    const changes: VoxelCellChange[] = [];
    for (const write of writes) {
      const { position, packed, partner } = resolvedWrite(layer, write);
      const before = reach === 0 ?
        packed :
        layer.getPackedVoxelAt(position);
      const beforePartner = reach === 0 ?
        partner :
        layer.getPartnerVoxelAt(position);
      layer.setPackedVoxelAt(position, packed, partner);
      for (const candidate of this.#layers) {
        candidate.markCellDirty(position);
      }

      if (!sameCell(before, beforePartner, packed, partner)) {
        changes.push({
          layerId: layer.id,
          position: {
            x: position.x,
            y: position.y,
            z: position.z
          },
          before,
          after: packed,
          beforePartner,
          afterPartner: partner
        });
      }
    }
    this.#deliver({
      changes: (reach & VOXEL_REACH_RECORDERS) === 0 ? [] : changes,
      observed: (reach & VOXEL_REACH_OBSERVERS) === 0 ? [] : changes
    });
  }

  #patchTracked(
    layer: VoxelLayer,
    writes: readonly VoxelWrite[],
    reach: number
  ): VoxelEditBatchFlush | null {
    const batch = new VoxelEditBatch(this.#chunkSize);
    const options = {
      track: true,
      reach
    };
    for (const write of writes) {
      const { position, packed, partner } = resolvedWrite(layer, write);
      batch.write(layer, position, packed, partner, options);
    }
    batch.markDirty(this.#layers.toArray());

    const [flushed] = batch.drain();
    if (flushed === undefined) {
      return null;
    }
    this.#deliver(flushed);

    return flushed;
  }

  #patchDirect(
    layer: VoxelLayer,
    patch: VoxelPatch
  ): VoxelEditCommand | null {
    assertVoxelPatch(patch);

    const { cells } = patch;
    const partners = patchPartnersByCell(patch);
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
          partners === null ?
            VOXEL_ABSENT :
            partners[written / VOXEL_PATCH_STRIDE],
          kUntrackedWrite
        );
      }
    }
    catch (error) {
      if (written > 0) {
        this.#publish(patched(
          layer.id,
          truncateVoxelPatch(patch, written / VOXEL_PATCH_STRIDE)
        ));
      }

      throw error;
    }
    finally {
      batch.markDirty(this.#layers.toArray());
    }

    return written > 0 ?
      patched(
        layer.id,
        truncateVoxelPatch(patch, written / VOXEL_PATCH_STRIDE)
      ) :
      null;
  }

  #flush(
    batch: VoxelEditBatch
  ): void {
    for (const flushed of batch.drain()) {
      this.#deliver(flushed);
      this.#publish(patched(
        flushed.layer.id,
        voxelPatch(flushed.cells, flushed.partners)
      ));
    }
  }

  #computeObserverReach(
    mode: VoxelWriteMode
  ): number {
    if (mode !== "live") {
      return 0;
    }

    const recorders = this.#suspended === 0 && this.#recorders.size > 0 ?
      VOXEL_REACH_RECORDERS :
      0;

    return recorders |
      (this.#observers.size > 0 ? VOXEL_REACH_OBSERVERS : 0);
  }

  #deliver(
    flushed: Pick<VoxelEditBatchFlush, "changes" | "observed">
  ): void {
    if (flushed.changes.length > 0) {
      for (const recorder of this.#recorders) {
        recorder.record(flushed.changes);
      }
    }
    if (flushed.observed.length > 0) {
      for (const recorder of this.#observers) {
        recorder.record(flushed.observed);
      }
    }
  }
}

function decodeVoxelWrites(
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
          ),
          partner: VOXEL_ABSENT,
          merge: command.metadata.merge === true
        }
      ];
    case "voxel-removed":
      return [
        {
          position: command.metadata.position,
          packed: VOXEL_ABSENT,
          partner: VOXEL_ABSENT,
          merge: false
        }
      ];
    case "voxels-set":
      return command.metadata.entries.map((entry) => {
        return {
          position: entry.position,
          packed: packVoxel(entry.blockId, VoxelTransform.pack(entry)),
          partner: VOXEL_ABSENT,
          merge: entry.merge === true
        };
      });
    case "voxels-removed":
      return command.metadata.entries.map(({ position }) => {
        return {
          position,
          packed: VOXEL_ABSENT,
          partner: VOXEL_ABSENT,
          merge: false
        };
      });
    case "voxels-patched":
      return patchWrites(command.metadata);
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

function resolvedWrite(
  layer: VoxelLayer,
  write: VoxelWrite
): VoxelWrite {
  const resolved = write.merge ? mergedWrite(layer, write) : write;
  const { packed, partner } = resolved;

  return partner === VOXEL_ABSENT ?
    resolved :
    {
      ...resolved,
      packed: cellPrimary(packed, partner),
      partner: cellPartner(packed, partner)
    };
}

function mergedWrite(
  layer: VoxelLayer,
  write: VoxelWrite
): VoxelWrite {
  const { position, packed } = write;
  const existing = layer.getPackedVoxelAt(position);
  const mergeable = packed !== VOXEL_ABSENT &&
    existing !== VOXEL_ABSENT &&
    existing !== packed &&
    layer.getPartnerVoxelAt(position) === VOXEL_ABSENT;

  return mergeable ?
    {
      ...write,
      packed: existing,
      partner: packed
    } :
    write;
}

function patchWrites(
  patch: VoxelPatch
): VoxelWrite[] {
  assertVoxelPatch(patch);

  const { cells } = patch;
  const partners = patchPartnersByCell(patch);
  const writes: VoxelWrite[] = [];
  for (let index = 0; index < cells.length; index += VOXEL_PATCH_STRIDE) {
    writes.push({
      position: {
        x: cells[index],
        y: cells[index + 1],
        z: cells[index + 2]
      },
      packed: packPatchCell(cells, index),
      partner: partners === null ?
        VOXEL_ABSENT :
        partners[index / VOXEL_PATCH_STRIDE],
      merge: false
    });
  }

  return writes;
}

function packPatchCell(
  cells: readonly number[],
  offset: number
): PackedVoxel {
  const blockId = cells[offset + 3];

  return isAir(blockId) ?
    VOXEL_ABSENT :
    packVoxel(blockId, cells[offset + 4]);
}

function patchPartnersByCell(
  patch: VoxelPatch
): Int32Array | null {
  const { cells, partners = [] } = patch;
  if (partners.length === 0) {
    return null;
  }

  const byCell = new Int32Array(cells.length / VOXEL_PATCH_STRIDE)
    .fill(VOXEL_ABSENT);
  for (
    let index = 0;
    index < partners.length;
    index += VOXEL_PATCH_PARTNER_STRIDE
  ) {
    byCell[partners[index]] = packVoxel(
      partners[index + 1],
      partners[index + 2]
    );
  }

  return byCell;
}

function truncateVoxelPatch(
  patch: VoxelPatch,
  cellCount: number
): VoxelPatch {
  const { cells, partners = [] } = patch;
  const kept: VoxelPatchPartners = [];
  for (
    let index = 0;
    index < partners.length;
    index += VOXEL_PATCH_PARTNER_STRIDE
  ) {
    if (partners[index] < cellCount) {
      kept.push(...partners.slice(index, index + VOXEL_PATCH_PARTNER_STRIDE));
    }
  }

  return voxelPatch(cells.slice(0, cellCount * VOXEL_PATCH_STRIDE), kept);
}

function patched(
  layerId: string,
  patch: VoxelPatch
): VoxelEditCommand {
  return {
    action: "voxels-patched",
    layerId,
    metadata: patch
  };
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
    ([x, y, z, packed, partner]): LayerCell => [
      x + ox,
      y + oy,
      z + oz,
      packed,
      partner
    ]
  );
  if (cells.length === 0) {
    return [];
  }

  const pivot = transformPivot(cells);
  const targets = new Set<string>();
  const writes: VoxelWrite[] = [];
  for (const [x, y, z, packed, partner] of cells) {
    const offset = transform.transformOffset({
      x: (2 * x) + 1 - pivot.x,
      y: (2 * y) + 1 - pivot.y,
      z: (2 * z) + 1 - pivot.z
    });
    const position = {
      x: (pivot.x + offset.x - 1) / 2,
      y: (pivot.y + offset.y - 1) / 2,
      z: (pivot.z + offset.z - 1) / 2
    };

    targets.add(`${position.x},${position.y},${position.z}`);
    writes.push({
      position,
      packed: turnVoxel(packed, transform),
      partner: turnVoxel(partner, transform),
      merge: false
    });
  }
  for (const [x, y, z] of cells) {
    if (!targets.has(`${x},${y},${z}`)) {
      writes.push({
        position: { x, y, z },
        packed: VOXEL_ABSENT,
        partner: VOXEL_ABSENT,
        merge: false
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
