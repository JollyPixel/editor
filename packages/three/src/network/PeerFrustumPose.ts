// Import Third-party Dependencies
import type * as THREE from "three";

// CONSTANTS
const kVector3Keys = ["x", "y", "z"] as const;
const kQuaternionKeys = ["x", "y", "z", "w"] as const;
const kPoseEpsilon = 1e-4;

type NumericRecord<
  TKeys extends readonly string[]
> = Record<TKeys[number], number>;

export interface PeerFrustumPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

export function decodePeerFrustumPose(
  value: unknown
): PeerFrustumPose | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const position = Reflect.get(value, "position");
  const quaternion = Reflect.get(value, "quaternion");
  if (
    !hasNumbers(position, kVector3Keys) ||
    !hasNumbers(quaternion, kQuaternionKeys)
  ) {
    return undefined;
  }

  return { position, quaternion };
}

export function peerFrustumPoseEqual(
  a: PeerFrustumPose,
  b: PeerFrustumPose,
  epsilon: number = kPoseEpsilon
): boolean {
  return kVector3Keys.every(
    (key) => Math.abs(a.position[key] - b.position[key]) <= epsilon
  ) && kQuaternionKeys.every(
    (key) => Math.abs(a.quaternion[key] - b.quaternion[key]) <= epsilon
  );
}

function hasNumbers<TKeys extends readonly string[]>(
  value: unknown,
  keys: TKeys
): value is NumericRecord<TKeys> {
  return typeof value === "object" && value !== null &&
    keys.every((key) => typeof Reflect.get(value, key) === "number");
}
