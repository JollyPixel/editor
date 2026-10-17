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
   * @default Defaults.nearRatio * depth
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
  displayName?: string;
  /**
   * Draw the name on a rounded background with a `color` border.
   * @default false
   */
  showNameBox?: boolean;
}

export interface PeerFrustumDefaults {
  fov: number;
  aspect: number;
  depth: number;
  /**
   * Multiplier applied to `depth` when `PeerFrustumOptions.near` is omitted.
   */
  nearRatio: number;
  color: THREE.ColorRepresentation;
  showApex: boolean;
  showNameBox: boolean;
}

interface FrustumCorners {
  readonly topLeft: THREE.Vector3;
  readonly topRight: THREE.Vector3;
  readonly bottomRight: THREE.Vector3;
  readonly bottomLeft: THREE.Vector3;
}

export class PeerFrustum extends THREE.LineSegments<
  THREE.BufferGeometry, THREE.LineBasicMaterial
> {
  static readonly Defaults: PeerFrustumDefaults = {
    fov: 50,
    aspect: 16 / 9,
    depth: 1.5,
    nearRatio: 0.2,
    color: "#43aa8b",
    showApex: false,
    showNameBox: false
  };

  label: PeerFrustumLabel | null = null;

  #color: THREE.ColorRepresentation;
  #showNameBox: boolean;
  #opacity = 1;

  constructor(
    options: PeerFrustumOptions = {}
  ) {
    const defaults = PeerFrustum.Defaults;
    const {
      fov = defaults.fov,
      aspect = defaults.aspect,
      depth = defaults.depth,
      near = depth * defaults.nearRatio,
      color = defaults.color,
      showApex = defaults.showApex,
      displayName,
      showNameBox = defaults.showNameBox
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
    if (displayName !== undefined) {
      this.label = new PeerFrustumLabel({
        displayName,
        color,
        showNameBox
      });
      this.add(this.label);
    }
  }

  get color(): THREE.ColorRepresentation {
    return this.#color;
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.material.color.set(color);
    this.#color = color;
    if (this.label !== null) {
      this.label.color = color;
    }
  }

  get opacity(): number {
    return this.#opacity;
  }

  set opacity(
    opacity: number
  ) {
    const next = Math.min(1, Math.max(0, opacity));
    if (next === this.#opacity) {
      return;
    }

    this.#opacity = next;
    this.material.opacity = next;
    this.material.transparent = next < 1;
    if (this.label !== null) {
      this.label.opacity = next;
    }
  }

  get displayName(): string | undefined {
    return this.label?.displayName;
  }

  set displayName(
    displayName: string
  ) {
    if (this.label === null) {
      this.label = new PeerFrustumLabel({
        displayName,
        color: this.#color,
        showNameBox: this.#showNameBox
      });
      this.label.opacity = this.#opacity;
      this.add(this.label);

      return;
    }
    this.label.displayName = displayName;
  }

  get showNameBox(): boolean {
    return this.#showNameBox;
  }

  set showNameBox(
    showNameBox: boolean
  ) {
    this.#showNameBox = showNameBox;
    if (this.label !== null) {
      this.label.showNameBox = showNameBox;
    }
  }

  override dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.label?.dispose();
  }

  static #computeCorners(
    fov: number,
    aspect: number,
    distance: number
  ): FrustumCorners {
    const halfHeight = distance * Math.tan(
      (fov / 2) * THREE.MathUtils.DEG2RAD
    );
    const halfWidth = halfHeight * aspect;

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
    const nearCorners = PeerFrustum.#computeCorners(
      fov,
      aspect,
      near
    );
    const farCorners = PeerFrustum.#computeCorners(
      fov,
      aspect,
      depth
    );

    const points = [
      nearCorners.topLeft, nearCorners.topRight,
      nearCorners.topRight, nearCorners.bottomRight,
      nearCorners.bottomRight, nearCorners.bottomLeft,
      nearCorners.bottomLeft, nearCorners.topLeft,

      farCorners.topLeft, farCorners.topRight,
      farCorners.topRight, farCorners.bottomRight,
      farCorners.bottomRight, farCorners.bottomLeft,
      farCorners.bottomLeft, farCorners.topLeft,

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
