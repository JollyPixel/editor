// Import Third-party Dependencies
import * as THREE from "three/webgpu";

export type AudioZoneShapeKind = "box" | "sphere";

export interface AudioZoneShapeSettings {
  /**
   * @default "box"
   */
  shape: AudioZoneShapeKind;
  /**
   * Full size of a box zone in the actor local units.
   * @default { x: 4, y: 4, z: 4 }
   */
  size: THREE.Vector3Like;
  /**
   * Radius of a sphere zone in the actor local units.
   * @default 2
   */
  radius: number;
}

// CONSTANTS
const kInverse = new THREE.Matrix4();
const kLocal = new THREE.Vector3();
const kHalfSize = new THREE.Vector3();

export class AudioZoneShape {
  readonly settings: Readonly<AudioZoneShapeSettings>;

  constructor(
    settings: Readonly<AudioZoneShapeSettings>
  ) {
    this.settings = {
      shape: settings.shape,
      size: {
        x: Math.max(settings.size.x, 0),
        y: Math.max(settings.size.y, 0),
        z: Math.max(settings.size.z, 0)
      },
      radius: Math.max(settings.radius, 0)
    };
  }

  distanceTo(
    point: Readonly<THREE.Vector3>,
    matrixWorld: Readonly<THREE.Matrix4>
  ): number {
    kLocal.copy(point).applyMatrix4(kInverse.copy(matrixWorld).invert());
    this.#clampInside(kLocal);

    return kLocal.applyMatrix4(matrixWorld).distanceTo(point);
  }

  outline(): THREE.BufferGeometry {
    const { shape, size, radius } = this.settings;
    if (shape === "box") {
      const box = new THREE.BoxGeometry(size.x, size.y, size.z);
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();

      return edges;
    }

    const circle = new THREE.EllipseCurve(0, 0, radius, radius).getPoints(48);
    const points: THREE.Vector3[] = [];
    for (const [index, point] of circle.entries()) {
      const next = circle[(index + 1) % circle.length];
      points.push(
        new THREE.Vector3(point.x, point.y, 0),
        new THREE.Vector3(next.x, next.y, 0),
        new THREE.Vector3(point.x, 0, point.y),
        new THREE.Vector3(next.x, 0, next.y),
        new THREE.Vector3(0, point.x, point.y),
        new THREE.Vector3(0, next.x, next.y)
      );
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  #clampInside(
    local: THREE.Vector3
  ): void {
    const { shape, size, radius } = this.settings;
    if (shape === "box") {
      kHalfSize.set(size.x / 2, size.y / 2, size.z / 2);
      local.clamp(kHalfSize.clone().negate(), kHalfSize);
    }
    else if (local.length() > radius) {
      local.setLength(radius);
    }
  }
}
