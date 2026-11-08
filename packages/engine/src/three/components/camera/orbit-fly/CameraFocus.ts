// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { OrbitFlyAction } from "./OrbitFlyKeys.ts";
import type {
  LookAngles,
  LookOrientation
} from "./LookAngles.ts";
import type { WorldScale } from "./WorldScale.ts";

// CONSTANTS
const kSmoothingSnapEpsilon = 1e-3;

export type OrbitFlyNudge = Extract<
  OrbitFlyAction,
  "forward" | "back" | "right" | "left" | "up" | "down"
>;

export interface FlyBody {
  position: THREE.Vector3;
  orientation: THREE.Quaternion;
}

export interface CameraFocusPose {
  body: FlyBody;
  angles: Readonly<LookAngles>;
  deltaTime: number;
  responsiveness: number;
}

export interface CameraFocusEnterRequest {
  point: THREE.Vector3Like | undefined;
  cameraPosition: THREE.Vector3;
  angles: Readonly<LookOrientation>;
  up: THREE.Vector3;
}

export interface CameraFocus {
  readonly isOrbiting: boolean;
  readonly isLocked: boolean;
  readonly pivot: THREE.Vector3Like | null;
  readonly settled: boolean;

  enter(
    request: CameraFocusEnterRequest
  ): LookOrientation | null;
  exit(): void;
  handleScroll(
    scrollY: number
  ): boolean;
  nudge(
    direction: OrbitFlyNudge,
    forward: THREE.Vector3,
    right: THREE.Vector3
  ): void;
  move(
    offset: THREE.Vector3,
    body: FlyBody
  ): void;
  teleported(
    position: THREE.Vector3Like,
    orientation: THREE.Quaternion
  ): void;
  updatePose(
    pose: CameraFocusPose
  ): void;
  dispose(): void;
}

export class NoCameraFocus implements CameraFocus {
  readonly isOrbiting = false;
  readonly isLocked = false;
  readonly pivot = null;
  readonly settled = true;

  enter(): null {
    return null;
  }

  exit(): void {
    return;
  }

  handleScroll(): boolean {
    return false;
  }

  nudge(): void {
    return;
  }

  move(
    offset: THREE.Vector3,
    body: FlyBody
  ): void {
    body.position.add(offset);
  }

  teleported(): void {
    return;
  }

  updatePose(): void {
    return;
  }

  dispose(): void {
    return;
  }
}

export function smoothingFactor(
  responsiveness: number,
  deltaTime: number
): number {
  return 1 - Math.exp(-responsiveness * deltaTime);
}

export function dampScalar(
  current: number,
  target: number,
  smoothing: number,
  scale: WorldScale
): number {
  const next = current + ((target - current) * smoothing);
  const snap = scale.length(kSmoothingSnapEpsilon);

  return Math.abs(target - next) < snap ? target : next;
}

export function dampVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  smoothing: number,
  scale: WorldScale
): void {
  const snap = scale.length(kSmoothingSnapEpsilon);

  current.lerp(target, smoothing);
  if (current.distanceToSquared(target) < snap ** 2) {
    current.copy(target);
  }
}
