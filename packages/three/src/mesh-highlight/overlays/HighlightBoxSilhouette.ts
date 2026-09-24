// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  DEFAULT_VISIBLE_FACES,
  buildSilhouetteGeometry,
  computeVisibleFaces,
  halfExtentsOf,
  sameFaces,
  writeOuterColor,
  type VisibleFaces
} from "./silhouetteGeometry.ts";

// CONSTANTS
const kXrayRenderOrder = 999;

export interface HighlightBoxSilhouetteOptions {
  /**
   * Box mesh to outline. The overlay is attached to it.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  opacity?: number;
  /**
   * Bar thickness in world units, not CSS pixels.
   * @default 0.05
   */
  linewidth?: number;
  /**
   * Draws the outline through other geometry.
   * @default false
   */
  xray?: boolean;
  /**
   * @default xray ? (peer ? kXrayRenderOrder - 1 : kXrayRenderOrder) : (peer ? 0 : 1)
   */
  renderOrder?: number;
  /**
   * Thin neutral bar between the surface and the colored outline. `0` disables it.
   * @default 0.02
   */
  innerThickness?: number;
  /**
   * @default "#000000"
   */
  innerColor?: THREE.ColorRepresentation;
  /**
   * Opacity of the portion hidden behind other geometry, when xray is
   * enabled. Drawn as a second depth-tested pass so the visible portion
   * stays at `opacity` and only the occluded one dims.
   * @default opacity (no dimming, matches the pre-existing xray behavior)
   */
  occludedOpacity?: number;
  /**
   * Renders above peer indicators when both land on adjoining geometry.
   * Only used to pick the default `renderOrder`; ignored when `renderOrder`
   * is given explicitly.
   * @default false
   */
  peer?: boolean;
  /**
   * Keeps the visible portion writing depth under xray, so transparent passes
   * drawn later (a grid, for instance) are hidden behind the outline.
   * @default false
   */
  xrayDepthWrite?: boolean;
}

type SilhouetteMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

function defaultRenderOrder(
  xray: boolean,
  peer: boolean
): number {
  if (xray) {
    return peer ? kXrayRenderOrder - 1 : kXrayRenderOrder;
  }

  return peer ? 0 : 1;
}

function createBackPass(
  front: SilhouetteMesh,
  occludedOpacity: number,
  renderOrder: number
): SilhouetteMesh {
  const material = front.material.clone();
  material.opacity = occludedOpacity;
  material.depthFunc = THREE.GreaterDepth;
  material.depthWrite = false;

  const mesh = new THREE.Mesh(front.geometry, material);
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;

  return mesh;
}

export class HighlightBoxSilhouette extends THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> {
  #target: THREE.Mesh;
  #thickness: number;
  #innerThickness: number;
  #innerColor: THREE.Color;
  #color: THREE.Color;
  #renderOrder: number;
  #xray: boolean;
  #xrayDepthWrite: boolean;
  #occludedOpacity: number;
  #outerColorStart: number;
  #back: SilhouetteMesh | null = null;
  #lastHalfExtents: THREE.Vector3 | null = null;
  #lastFaces: VisibleFaces | null = null;

  constructor(
    options: HighlightBoxSilhouetteOptions
  ) {
    const {
      target,
      color = "#ffffff",
      opacity = 1,
      linewidth = 0.05,
      xray = false,
      peer = false,
      renderOrder = defaultRenderOrder(xray, peer),
      innerThickness = 0.02,
      innerColor = "#000000",
      occludedOpacity = opacity,
      xrayDepthWrite = false
    } = options;

    const halfExtents = halfExtentsOf(target);
    const colorObject = new THREE.Color(color);
    const innerColorObject = new THREE.Color(innerColor);
    const built = buildSilhouetteGeometry({
      halfExtents,
      faces: DEFAULT_VISIBLE_FACES,
      innerThickness,
      linewidth,
      innerColor: innerColorObject,
      color: colorObject
    });

    super(
      built.geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity,
        depthTest: true
      })
    );

    this.#target = target;
    this.#thickness = linewidth;
    this.#innerThickness = innerThickness;
    this.#innerColor = innerColorObject;
    this.#color = colorObject;
    this.#renderOrder = renderOrder;
    this.#xray = xray;
    this.#xrayDepthWrite = xrayDepthWrite;
    this.#occludedOpacity = occludedOpacity;
    this.#outerColorStart = built.outerColorStart;
    this.renderOrder = renderOrder;
    this.frustumCulled = false;
    target.add(this);

    this.#applyXray();
  }

  get color(): THREE.Color {
    return this.#color.clone();
  }

  set color(
    color: THREE.ColorRepresentation
  ) {
    this.#color.set(color);
    writeOuterColor(this.geometry, this.#outerColorStart, this.#color);
  }

  get opacity(): number {
    return this.material.opacity;
  }

  set opacity(
    opacity: number
  ) {
    this.material.opacity = opacity;
  }

  get linewidth(): number {
    return this.#thickness;
  }

  set linewidth(
    linewidth: number
  ) {
    this.#thickness = linewidth;
  }

  get xray(): boolean {
    return this.#xray;
  }

  set xray(
    xray: boolean
  ) {
    this.#xray = xray;
    this.#applyXray();
  }

  get occludedOpacity(): number {
    return this.#occludedOpacity;
  }

  set occludedOpacity(
    occludedOpacity: number
  ) {
    this.#occludedOpacity = occludedOpacity;
    if (this.#back) {
      this.#back.material.opacity = occludedOpacity;
    }
  }

  update(
    cameraWorldPosition: THREE.Vector3
  ): void {
    const halfExtents = halfExtentsOf(this.#target);
    const localCameraPosition = this.#target.worldToLocal(cameraWorldPosition.clone());
    const faces = computeVisibleFaces(localCameraPosition, halfExtents);

    if (
      this.#lastHalfExtents?.equals(halfExtents) &&
      this.#lastFaces && sameFaces(this.#lastFaces, faces)
    ) {
      return;
    }

    const built = buildSilhouetteGeometry({
      halfExtents,
      faces,
      innerThickness: this.#innerThickness,
      linewidth: this.#thickness,
      innerColor: this.#innerColor,
      color: this.#color
    });
    this.geometry.dispose();
    this.geometry = built.geometry;
    this.#outerColorStart = built.outerColorStart;
    if (this.#back) {
      this.#back.geometry = built.geometry;
    }

    this.#lastHalfExtents = halfExtents;
    this.#lastFaces = faces;
  }

  override dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
    this.#back?.material.dispose();
  }

  /**
   * Off xray, occlusion just works: an occluded fragment fails the normal
   * depth test and never draws, same as any other depth-tested mesh. Xray
   * keeps that same front pass (so the visible portion looks identical) and
   * adds a second, depth-inverted pass that only draws the occluded portion,
   * dimmed. The two never overlap a pixel, so there is nothing to blend twice.
   */
  #applyXray(): void {
    this.material.depthWrite = !this.#xray || this.#xrayDepthWrite;

    if (!this.#xray) {
      this.#back?.removeFromParent();
      this.#back?.material.dispose();
      this.#back = null;

      return;
    }

    if (!this.#back) {
      this.#back = createBackPass(this, this.#occludedOpacity, this.#renderOrder);
      this.add(this.#back);
    }
  }
}
