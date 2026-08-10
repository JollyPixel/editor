// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { PeerFrustumLabel } from "./PeerFrustumLabel.ts";

export interface PeerFrustumOptions {
  /**
   * Vertical field of view in degrees.
   * @default 50
   */
  fov?: number;
  /**
   * Width-to-height ratio.
   * @default 16 / 9
   */
  aspect?: number;
  /**
   * Distance from the local origin to the near rectangle, in world units.
   * Must be strictly between 0 and `depth`.
   * @default depth * 0.2
   */
  near?: number;
  /**
   * Distance from the local origin to the far rectangle, in world units.
   * @default 1.5
   */
  depth?: number;
  /**
   * Wireframe and label accent color.
   * @default "#43aa8b"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Draw lines from the local origin to the near rectangle.
   * @default false
   */
  showApex?: boolean;
  /**
   * Display name rendered above the frustum. Omit to skip the label.
   */
  name?: string;
  /**
   * Draw the name on a rounded background with a `color` border.
   * @default false
   */
  showNameBox?: boolean;
}

interface FrustumCorners {
  readonly topLeft: THREE.Vector3;
  readonly topRight: THREE.Vector3;
  readonly bottomRight: THREE.Vector3;
  readonly bottomLeft: THREE.Vector3;
}

/**
 * Static wireframe camera shape for peer presence.
 * Geometry points along local `-Z`; copy the represented camera's position
 * and quaternion.
 */
export class PeerFrustum extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  /**
   * Label created by the constructor or first `setName()` call.
   * `null` until a name is provided.
   */
  label: PeerFrustumLabel | null = null;

  #color: THREE.ColorRepresentation;
  #showNameBox: boolean;

  constructor(
    options: PeerFrustumOptions = {}
  ) {
    const {
      fov = 50,
      aspect = 16 / 9,
      depth = 1.5,
      near = depth * 0.2,
      color = "#43aa8b",
      showApex = false,
      name,
      showNameBox = false
    } = options;

    if (near <= 0 || near >= depth) {
      throw new Error(
        `"near" (${near}) must be greater than 0 and less than "depth" (${depth})`
      );
    }

    super(
      PeerFrustum.#buildGeometry(fov, aspect, near, depth, showApex),
      new THREE.LineBasicMaterial({ color })
    );

    this.#color = color;
    this.#showNameBox = showNameBox;
    if (name !== undefined) {
      this.label = new PeerFrustumLabel({ name, color, showNameBox });
      this.add(this.label);
    }
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.material.color.set(color);
    this.#color = color;
    this.label?.setColor(color);
  }

  setName(
    name: string
  ): void {
    if (this.label === null) {
      this.label = new PeerFrustumLabel({ name, color: this.#color, showNameBox: this.#showNameBox });
      this.add(this.label);

      return;
    }
    this.label.setName(name);
  }

  setShowNameBox(
    showNameBox: boolean
  ): void {
    this.#showNameBox = showNameBox;
    this.label?.setShowNameBox(showNameBox);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.label?.dispose();
  }

  static #computeCorners(
    fov: number,
    aspect: number,
    distance: number
  ): FrustumCorners {
    const halfHeight = distance * Math.tan((fov / 2) * THREE.MathUtils.DEG2RAD);
    const halfWidth = halfHeight * aspect;

    // Camera looks down local -Z (Three.js / engine convention).
    return {
      topLeft: new THREE.Vector3(-halfWidth, halfHeight, -distance),
      topRight: new THREE.Vector3(halfWidth, halfHeight, -distance),
      bottomRight: new THREE.Vector3(halfWidth, -halfHeight, -distance),
      bottomLeft: new THREE.Vector3(-halfWidth, -halfHeight, -distance)
    };
  }

  static #buildGeometry(
    fov: number,
    aspect: number,
    near: number,
    depth: number,
    showApex: boolean
  ): THREE.BufferGeometry {
    const nearCorners = PeerFrustum.#computeCorners(fov, aspect, near);
    const farCorners = PeerFrustum.#computeCorners(fov, aspect, depth);

    // Each consecutive pair is one segment (THREE.LineSegments, no index needed).
    const points = [
      // Near-plane rectangle
      nearCorners.topLeft, nearCorners.topRight,
      nearCorners.topRight, nearCorners.bottomRight,
      nearCorners.bottomRight, nearCorners.bottomLeft,
      nearCorners.bottomLeft, nearCorners.topLeft,

      // Far-plane rectangle
      farCorners.topLeft, farCorners.topRight,
      farCorners.topRight, farCorners.bottomRight,
      farCorners.bottomRight, farCorners.bottomLeft,
      farCorners.bottomLeft, farCorners.topLeft,

      // Body connects each near corner to its far counterpart
      nearCorners.topLeft, farCorners.topLeft,
      nearCorners.topRight, farCorners.topRight,
      nearCorners.bottomRight, farCorners.bottomRight,
      nearCorners.bottomLeft, farCorners.bottomLeft
    ];

    if (showApex) {
      const apex = new THREE.Vector3(0, 0, 0);
      points.push(...[
        apex, nearCorners.topLeft,
        apex, nearCorners.topRight,
        apex, nearCorners.bottomRight,
        apex, nearCorners.bottomLeft
      ]);
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }
}

export type {
  PeerFrustumLabelOptions
} from "./PeerFrustumLabel.ts";
export {
  PeerFrustumLabel
};
