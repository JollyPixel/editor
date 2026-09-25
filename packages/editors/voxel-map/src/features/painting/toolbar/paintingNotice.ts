// Import Internal Dependencies
import type { SelectionStore } from "../../../state/index.ts";

export interface PaintingNotice {
  message: string;
  resumeLayer: string | null;
}

export function paintingNoticeOf(
  selection: Pick<SelectionStore, "voxelLayer" | "lastVoxelLayer">
): PaintingNotice | null {
  if (selection.voxelLayer !== null) {
    return null;
  }

  const resumeLayer = selection.lastVoxelLayer;

  return resumeLayer === null ?
    {
      message: "No voxel layer to paint on",
      resumeLayer
    } :
    {
      message: "Object layer selected",
      resumeLayer
    };
}
