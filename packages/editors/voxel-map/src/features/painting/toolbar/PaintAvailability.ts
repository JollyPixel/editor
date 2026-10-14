// Import Internal Dependencies
import type { SelectionStore } from "../../../state/index.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";
import type { MapAccess } from "../../../access/MapAccess.ts";

// CONSTANTS
export const BRUSH_NO_BLOCK_REASON = "Create a block in the Block Library to paint";
export const BRUSH_NO_LAYER_REASON = "Select a voxel layer to paint";
export const BRUSH_SUSPENDED_REASON = "Commit or cancel the placement to paint";
export const BRUSH_VIEW_ONLY_REASON = "You can only view this map";

export type PaintingSelection = Pick<
  SelectionStore,
  "voxelLayer" | "lastVoxelLayer"
>;

export interface PaintConditions {
  selection: PaintingSelection;
  hasBlock: boolean;
  suspended: boolean;
  access: MapAccess;
}

export interface PaintingNotice {
  readonly message: string;
  readonly resumeLayer: string | null;
}

export class PaintAvailability {
  static readonly Ready = new PaintAvailability(null, null);

  static watch(
    workspace: VoxelMapWorkspace,
    listener: (availability: PaintAvailability) => void
  ): Iterable<() => void> {
    const { mapDocument, access } = workspace;
    const { brush, block, selection } = workspace.state;
    function refresh(): void {
      listener(PaintAvailability.evaluate({
        selection,
        hasBlock: block.resolve(mapDocument.blocks) !== undefined,
        suspended: brush.suspended,
        access: access.current
      }));
    }

    refresh();

    return [
      access.subscribe("change", refresh),
      brush.subscribe("suspendedChange", refresh),
      block.subscribe("change", refresh),
      selection.subscribe("change", refresh),
      mapDocument.subscribe("layerUpdated", refresh)
    ];
  }

  static evaluate(
    conditions: PaintConditions
  ): PaintAvailability {
    const { selection, hasBlock, suspended, access } = conditions;
    if (!access.has("voxels")) {
      return new PaintAvailability(BRUSH_VIEW_ONLY_REASON, {
        message: "View only",
        resumeLayer: null
      });
    }
    if (suspended) {
      return new PaintAvailability(BRUSH_SUSPENDED_REASON, null);
    }
    if (!hasBlock) {
      return new PaintAvailability(BRUSH_NO_BLOCK_REASON, {
        message: "No block to paint with",
        resumeLayer: null
      });
    }
    if (selection.voxelLayer !== null) {
      return PaintAvailability.Ready;
    }

    const resumeLayer = selection.lastVoxelLayer;
    const message = resumeLayer === null ?
      "No voxel layer to paint on" :
      "Object layer selected";

    return new PaintAvailability(BRUSH_NO_LAYER_REASON, {
      message,
      resumeLayer
    });
  }

  readonly reason: string | null;
  readonly notice: PaintingNotice | null;

  constructor(
    reason: string | null,
    notice: PaintingNotice | null
  ) {
    this.reason = reason;
    this.notice = notice === null ? null : Object.freeze({ ...notice });

    Object.freeze(this);
  }

  get blocked(): boolean {
    return this.reason !== null;
  }

  equals(
    other: PaintAvailability
  ): boolean {
    return this.reason === other.reason &&
      this.notice?.message === other.notice?.message &&
      this.notice?.resumeLayer === other.notice?.resumeLayer;
  }
}
