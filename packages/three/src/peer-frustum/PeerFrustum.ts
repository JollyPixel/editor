// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { frustumLinePoints } from "../common/geometry/frustumLines.ts";
import { HaloLines } from "../common/lines/HaloLines.ts";
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

export class PeerFrustum extends THREE.Group {
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

  readonly #wire: HaloLines;
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

    super();

    this.#wire = new HaloLines(color);
    this.#wire.redraw(frustumLinePoints(
      {
        projection: "perspective",
        fov,
        aspect,
        near,
        far: depth
      },
      { apex: showApex }
    ));
    this.add(this.#wire);
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
    this.#wire.paint(color);
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
    this.#wire.fade(next);
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
    this.#wire.dispose();
    this.label?.dispose();
  }
}

export type {
  PeerFrustumLabelOptions
} from "./PeerFrustumLabel.ts";

export {
  PeerFrustumLabel
};
