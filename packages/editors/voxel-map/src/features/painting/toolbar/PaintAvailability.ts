// Import Internal Dependencies
import type { SelectionStore } from "../../../state/index.ts";
import type { VoxelMapWorkspace } from "../../../workspace/VoxelMapWorkspace.ts";

// CONSTANTS
export const BRUSH_NO_LAYER_REASON = "Select a voxel layer to paint";
export const BRUSH_SUSPENDED_REASON = "Commit or cancel the placement to paint";

export type PaintingSelection = Pick<
  SelectionStore,
  "voxelLayer" | "lastVoxelLayer"
>;

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
    const { brush, mapDocument } = workspace;
    const { selection } = workspace.state;
    function refresh(): void {
      listener(PaintAvailability.of(selection, brush.suspended));
    }

    refresh();

    return [
      brush.subscribe("suspendedChange", refresh),
      selection.subscribe("change", refresh),
      mapDocument.subscribe("layerUpdated", refresh)
    ];
  }

  static of(
    selection: PaintingSelection,
    suspended: boolean
  ): PaintAvailability {
    if (suspended) {
      return new PaintAvailability(BRUSH_SUSPENDED_REASON, null);
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
