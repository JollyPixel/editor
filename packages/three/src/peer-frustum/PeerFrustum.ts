// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kLabelCanvasWidth = 384;
const kLabelCanvasHeight = 96;
const kLabelWorldWidth = 1.6;
const kLabelWorldHeight = kLabelWorldWidth * (kLabelCanvasHeight / kLabelCanvasWidth);
const kLabelOffsetY = 0.45;

export interface PeerFrustumOptions {
  /**
   * Vertical field of view in degrees, used only to shape the visualized frustum
   * (not tied to the represented peer's actual camera near/far planes).
   * @default 50
   */
  fov?: number;
  /**
   * @default 16 / 9
   */
  aspect?: number;
  /**
   * Near-plane visualization distance (apex-to-near-plane), in world units.
   * Purely cosmetic — drawn as a wireframe rectangle, not a filled plane.
   * Must be strictly between 0 and `depth`.
   * @default depth * 0.2
   */
  near?: number;
  /**
   * Visualization depth (apex-to-far-plane distance), in world units. Purely
   * controls how large the frustum reads on screen.
   * @default 1.5
   */
  depth?: number;
  /**
   * @default "#43aa8b"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Whether to draw the tip lines from the apex (the peer's position) down to
   * the near plane. Enable for an at-a-glance sense of exactly where the peer
   * is — the near/far rectangles and the edges connecting them are always
   * drawn regardless.
   * @default false
   */
  showApex?: boolean;
  /**
   * Display name for the connected peer, rendered as a floating nameplate
   * above the frustum. Omit to render the frustum without one.
   */
  name?: string;
  /**
   * Draws the nameplate on a rounded, semi-transparent background box
   * (bordered with `color`) instead of the default shadow-only text.
   * @default false
   */
  showNameBox?: boolean;
}

interface FrustumCorners {
  topLeft: THREE.Vector3;
  topRight: THREE.Vector3;
  bottomRight: THREE.Vector3;
  bottomLeft: THREE.Vector3;
}

/**
 * Lightweight camera-frustum representation for a connected peer.
 *
 * Deliberately not a `THREE.CameraHelper`: that requires a real `THREE.Camera`
 * per peer and draws extra guide lines (target cross) not wanted for a presence
 * indicator. This builds a static wireframe truncated pyramid (near/far
 * rectangles + connecting edges, optionally with an apex tip) once from a
 * fixed FOV/aspect/near/depth; position/orient it via the usual `Object3D`
 * transform (`.position`, `.lookAt()`, ...), so N peers stay cheap — no
 * per-peer projection-matrix work.
 */
export class PeerFrustum extends THREE.LineSegments {
  #color: THREE.ColorRepresentation;
  #name: string | undefined;
  #showNameBox: boolean;
  #label: THREE.Sprite | null = null;
  #labelCanvas: HTMLCanvasElement | null = null;

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
    this.#name = name;
    this.#showNameBox = showNameBox;
    if (name !== undefined) {
      this.#createLabel();
    }
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    (this.material as THREE.LineBasicMaterial).color.set(color);
    this.#color = color;
    this.#refreshLabel();
  }

  setName(
    name: string
  ): void {
    this.#name = name;
    if (this.#label === null) {
      this.#createLabel();

      return;
    }
    this.#refreshLabel();
  }

  setShowNameBox(
    showNameBox: boolean
  ): void {
    this.#showNameBox = showNameBox;
    this.#refreshLabel();
  }

  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();

    if (this.#label !== null) {
      (this.#label.material.map as THREE.CanvasTexture).dispose();
      this.#label.material.dispose();
    }
  }

  #createLabel(): void {
    this.#labelCanvas = document.createElement("canvas");
    this.#labelCanvas.width = kLabelCanvasWidth;
    this.#labelCanvas.height = kLabelCanvasHeight;
    PeerFrustum.#drawLabel(
      this.#labelCanvas,
      this.#name ?? "",
      this.#color,
      this.#showNameBox
    );

    const texture = new THREE.CanvasTexture(this.#labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    this.#label = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        depthTest: false,
        depthWrite: false,
        transparent: true
      })
    );
    this.#label.scale.set(kLabelWorldWidth, kLabelWorldHeight, 1);
    this.#label.position.set(0, kLabelOffsetY, 0);
    this.#label.renderOrder = 1;

    this.add(this.#label);
  }

  #refreshLabel(): void {
    if (this.#label === null || this.#labelCanvas === null) {
      return;
    }

    PeerFrustum.#drawLabel(
      this.#labelCanvas,
      this.#name ?? "",
      this.#color,
      this.#showNameBox
    );
    (this.#label.material.map as THREE.CanvasTexture).needsUpdate = true;
  }

  static #drawLabel(
    canvas: HTMLCanvasElement,
    name: string,
    color: THREE.ColorRepresentation,
    showNameBox: boolean
  ): void {
    const context = canvas.getContext("2d")!;
    const { width, height } = canvas;
    const colorStyle = new THREE.Color(color).getStyle();

    context.clearRect(0, 0, width, height);

    if (showNameBox) {
      context.fillStyle = "rgba(20, 20, 20, 0.75)";
      context.strokeStyle = colorStyle;
      context.lineWidth = 6;
      context.beginPath();
      context.roundRect(3, 3, width - 6, height - 6, height / 2);
      context.fill();
      context.stroke();

      context.fillStyle = "#ffffff";
    }
    else {
      // No background box — a dark drop shadow keeps the colored text legible
      // against any scene background instead.
      context.shadowColor = "rgba(0, 0, 0, 0.9)";
      context.shadowBlur = 6;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 2;

      context.fillStyle = colorStyle;
    }

    context.font = "700 60px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(name, width / 2, height / 2);

    context.shadowColor = "transparent";
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

      // Body — connects each near corner to its far counterpart
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
