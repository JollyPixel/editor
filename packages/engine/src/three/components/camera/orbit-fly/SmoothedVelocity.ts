// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { WorldScale } from "./WorldScale.ts";

// CONSTANTS
const kRestingSpeed = 1e-3;

export interface SmoothedVelocityOptions {
  accelerationTime: number;
  brakingTime: number;
  scale: WorldScale;
}

export class SmoothedVelocity {
  readonly value = new THREE.Vector3();

  #accelerationTime: number;
  #brakingTime: number;
  #scale: WorldScale;
  #acceleration = new THREE.Vector3();
  #change = new THREE.Vector3();
  #impulse = new THREE.Vector3();

  constructor(
    options: SmoothedVelocityOptions
  ) {
    this.#accelerationTime = options.accelerationTime;
    this.#brakingTime = options.brakingTime;
    this.#scale = options.scale;
  }

  get resting(): boolean {
    return this.value.lengthSq() === 0;
  }

  approach(
    target: THREE.Vector3,
    deltaTime: number
  ): void {
    const braking = target.lengthSq() === 0;
    const smoothTime = braking ? this.#brakingTime : this.#accelerationTime;
    if (smoothTime === 0) {
      this.value.copy(target);
      this.#acceleration.set(0, 0, 0);

      return;
    }

    const omega = 2 / smoothTime;
    const decay = Math.exp(-omega * deltaTime);

    this.#change.subVectors(this.value, target);
    this.#impulse
      .copy(this.#acceleration)
      .addScaledVector(this.#change, omega)
      .multiplyScalar(deltaTime);
    this.#acceleration
      .addScaledVector(this.#impulse, -omega)
      .multiplyScalar(decay);
    this.value
      .copy(this.#change.add(this.#impulse).multiplyScalar(decay))
      .add(target);

    const restingSpeed = this.#scale.length(kRestingSpeed);
    if (braking && this.value.lengthSq() < restingSpeed ** 2) {
      this.stop();
    }
  }

  stop(): void {
    this.value.set(0, 0, 0);
    this.#acceleration.set(0, 0, 0);
  }
}
