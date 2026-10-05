// Import Internal Dependencies
import { FACE } from "../../../geometry/faceDirection.ts";

export type JunctionType =
  | "end"
  | "straight"
  | "corner"
  | "tee"
  | "cross";

// CONSTANTS
export const JUNCTION_ARMS: Record<JunctionType, readonly FACE[]> = {
  end: [FACE.PosZ],
  straight: [FACE.NegZ, FACE.PosZ],
  corner: [FACE.PosZ, FACE.PosX],
  tee: [FACE.NegZ, FACE.PosZ, FACE.PosX],
  cross: [FACE.NegZ, FACE.PosZ, FACE.NegX, FACE.PosX]
};
export const JUNCTION_ID_SUFFIX: Record<JunctionType, string> = {
  end: "End",
  straight: "",
  corner: "Corner",
  tee: "Tee",
  cross: "Cross"
};
