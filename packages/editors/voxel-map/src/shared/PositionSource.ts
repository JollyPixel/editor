// Import Third-party Dependencies
import * as THREE from "three";
import type {
  FieldSource,
  Vec3Like
} from "@jolly-pixel/ui";

// CONSTANTS
const kOrigin = new THREE.Vector3();

export interface PositionPort {
  position(): Vec3Like | null;
  move(position: Vec3Like): void;
}

export class PositionSource implements FieldSource<Vec3Like> {
  #port: PositionPort;

  constructor(
    port: PositionPort
  ) {
    this.#port = port;
  }

  read(): Vec3Like {
    return new THREE.Vector3()
      .copy(this.#port.position() ?? kOrigin)
      .round();
  }

  write(
    value: Vec3Like
  ): void {
    const current = this.#port.position();
    if (current === null) {
      return;
    }

    const position = new THREE.Vector3()
      .copy(value)
      .round();
    if (position.equals(new THREE.Vector3()
      .copy(current)
      .round())) {
      return;
    }

    this.#port.move(position);
  }
}
