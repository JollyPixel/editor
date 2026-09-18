// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";

// CONSTANTS
const kSmoothingSnapEpsilon = 1e-3;

export type CameraFocusTransform = Actor["transform"];
export type CameraFocusInput = Actor["world"]["input"];

export interface CameraFocusPose {
  transform: CameraFocusTransform;
  yaw: number;
  pitch: number;
  orientation: THREE.Quaternion;
  deltaTime: number;
  responsiveness: number;
}

export interface CameraFocusEnterRequest {
  point: THREE.Vector3Like | undefined;
  cameraPosition: THREE.Vector3;
  yaw: number;
  pitch: number;
  up: THREE.Vector3;
}

export interface CameraFocusOrientation {
  yaw: number;
  pitch: number;
}

export interface CameraFocus {
  readonly isOrbiting: boolean;
  readonly isLocked: boolean;
  readonly pivot: THREE.Vector3Like | null;

  enter(
    request: CameraFocusEnterRequest
  ): CameraFocusOrientation | null;
  exit(): void;
  handleScroll(
    scrollY: number,
    scrollSpeed: number
  ): boolean;
  nudge(
    input: CameraFocusInput,
    forward: THREE.Vector3,
    right: THREE.Vector3
  ): void;
  move(
    offset: THREE.Vector3,
    transform: CameraFocusTransform
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
    transform: CameraFocusTransform
  ): void {
    transform.moveGlobal(offset);
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
  smoothing: number
): number {
  const next = current + ((target - current) * smoothing);

  return Math.abs(target - next) < kSmoothingSnapEpsilon ? target : next;
}

export function dampVector(
  current: THREE.Vector3,
  target: THREE.Vector3,
  smoothing: number
): void {
  current.lerp(target, smoothing);
  if (current.distanceToSquared(target) < kSmoothingSnapEpsilon ** 2) {
    current.copy(target);
  }
}
