// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { NumberRange } from "./NumberRange.ts";

// CONSTANTS
const kQuaternion = new THREE.Quaternion();

export interface LookOrientation {
  yaw: number;
  pitch: number;
}

export class LookAngles implements Readonly<LookOrientation> {
  #yaw = 0;
  #pitch = 0;
  #pitchRange: NumberRange;
  #euler = new THREE.Euler(0, 0, 0, "YXZ");

  constructor(
    orientation: Readonly<LookOrientation>,
    maxPitch: number
  ) {
    this.#pitchRange = new NumberRange(-maxPitch, maxPitch);
    this.aim(orientation);
  }

  get yaw(): number {
    return this.#yaw;
  }

  get pitch(): number {
    return this.#pitch;
  }

  aim(
    orientation: Readonly<LookOrientation>
  ): void {
    this.#yaw = orientation.yaw;
    this.#pitch = this.#pitchRange.clamp(orientation.pitch);
  }

  turn(
    yawDelta: number,
    pitchDelta: number
  ): void {
    this.aim({
      yaw: this.#yaw + yawDelta,
      pitch: this.#pitch + pitchDelta
    });
  }

  face(
    quaternion: THREE.QuaternionLike
  ): void {
    const { x, y, z, w } = quaternion;
    this.#euler.setFromQuaternion(kQuaternion.set(x, y, z, w));
    this.aim({
      yaw: this.#euler.y,
      pitch: this.#euler.x
    });
  }

  writeTo(
    orientation: THREE.Quaternion
  ): THREE.Quaternion {
    return orientation.setFromEuler(
      this.#euler.set(this.#pitch, this.#yaw, 0)
    );
  }
}
