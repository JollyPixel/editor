// Import Third-party Dependencies
import type * as THREE from "three";

export interface PeerFrustumPresence {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

export function isPeerFrustumPresence(
  value: unknown
): value is PeerFrustumPresence {
  return typeof value === "object" && value !== null &&
    isVector3Like((value as Partial<PeerFrustumPresence>).position) &&
    isQuaternionLike((value as Partial<PeerFrustumPresence>).quaternion);
}

function isVector3Like(
  value: unknown
): value is THREE.Vector3Like {
  return typeof value === "object" && value !== null &&
    "x" in value && "y" in value && "z" in value &&
    typeof value.x === "number" && typeof value.y === "number" && typeof value.z === "number";
}

function isQuaternionLike(
  value: unknown
): value is THREE.QuaternionLike {
  return typeof value === "object" && value !== null &&
    "x" in value && "y" in value && "z" in value && "w" in value &&
    typeof value.x === "number" && typeof value.y === "number" &&
    typeof value.z === "number" && typeof value.w === "number";
}

export function peerFrustumPresenceEqual(
  a: PeerFrustumPresence | null,
  b: PeerFrustumPresence | null
): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.position.z === b.position.z &&
    a.quaternion.x === b.quaternion.x &&
    a.quaternion.y === b.quaternion.y &&
    a.quaternion.z === b.quaternion.z &&
    a.quaternion.w === b.quaternion.w;
}
