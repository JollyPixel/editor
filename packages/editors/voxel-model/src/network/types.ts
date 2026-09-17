// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { ModelHookEvent } from "../features/groups/hooks.ts";
import type { MirrorAxes } from "../features/groups/mirrorTransform.ts";

export interface Vector3JSON {
  x: number;
  y: number;
  z: number;
}

export interface ModelNodeJSON {
  uuid: string;
  name: string;
  parentUuid: string | null;
  position: Vector3JSON;
  pivotOffset: Vector3JSON;
  size: Vector3JSON;
  scale: Vector3JSON;
  /** Euler angles in radians, XYZ order. */
  rotation: Vector3JSON;
  /** Absent when the block was never mirrored. */
  flipAxes?: MirrorAxes;
}

export type ModelNetworkCommand = ModelHookEvent & network.NetworkCommandHeader;

export type ModelServerMessage = network.NetworkServerMessage<
  ModelNetworkCommand,
  ModelNodeJSON[]
>;
