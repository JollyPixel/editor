// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { MirrorAxes } from "./mirrorTransform.ts";

export interface GroupTransformSnapshot {
  position: Vector3Like;
  pivotOffset: Vector3Like;
  size: Vector3Like;
  scale: Vector3Like;
  /** Euler angles in radians, XYZ order. */
  rotation: Vector3Like;
}

export type ModelHookEvent =
  | {
    /** Always at the scene root; a separate reparent event follows if needed. */
    action: "group-added";
    uuid: string;
    name: string;
    transform: GroupTransformSnapshot;
  }
  | {
    action: "group-removed";
    uuid: string;
  }
  | {
    action: "group-renamed";
    uuid: string;
    name: string;
  }
  | {
    /** World-preserving reparent; carries the resulting local transform. */
    action: "group-reparented";
    uuid: string;
    parentUuid: string | null;
    transform: GroupTransformSnapshot;
  }
  | {
    /** Local-position-preserving reparent (`Object3D#add`); nothing changes. */
    action: "group-reparented-local";
    uuid: string;
    parentUuid: string | null;
  }
  | {
    /** `flipAxes` is only set when the transform came from a mirror operation. */
    action: "group-transformed";
    uuid: string;
    transform: GroupTransformSnapshot;
    flipAxes?: MirrorAxes;
  };

export type ModelHookAction = ModelHookEvent["action"];

export const MODEL_HOOK_ACTIONS: readonly ModelHookAction[] = [
  "group-added",
  "group-removed",
  "group-renamed",
  "group-reparented",
  "group-reparented-local",
  "group-transformed"
];

export type ModelHookListener = (
  event: ModelHookEvent
) => void;
