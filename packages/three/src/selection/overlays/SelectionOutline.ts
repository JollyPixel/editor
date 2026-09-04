// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { inflateEdgesGeometry } from "./inflateEdgesGeometry.ts";

// CONSTANTS
// Edges sit exactly on the target's own surface, so identical depth values
// z-fight with the mesh (a dashed/flickering line). `glPolygonOffset`
// doesn't apply to GL_LINES, so nudge each edge vertex outward along its
// own surface normal instead (`inflateEdgesGeometry`), as a fraction of the
// bounding-sphere radius so it reads the same at any mesh size.
const kOffsetFactor = 0.006;
// Draws after every default-renderOrder object, so an `xray` outline wins
// the pixel even though it skips the depth test.
const kXrayRenderOrder = 999;
// Dash/gap size for `dashed`, as a fraction of the bounding-sphere radius,
// same convention as `kOffsetFactor`.
const kDashSizeFactor = 0.06;
const kGapSizeFactor = 0.04;

export interface SelectionOutlineOptions {
  /**
   * Mesh being outlined. The outline is added as a child of `target`, so it
   * inherits its transform for free and is automatically removed if `target`
   * itself is later removed from the scene.
   */
  target: THREE.Mesh;
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Material opacity. Lets a dimmer "hover" outline and a full "selected"
   * outline share the same class without a second visual language.
   * @default 1
   */
  opacity?: number;
  /**
   * Line thickness in (CSS) pixels, forwarded to
   * `THREE.LineBasicMaterial.linewidth`. Most WebGL backends clamp this to
   * 1 regardless of value (a long-standing GL_LINES driver limitation) - not
   * guaranteed to have a visible effect; `WebGPURenderer` is unaffected.
   * @default 1
   */
  linewidth?: number;
  /**
   * Skips the depth test/write so the outline stays visible through other
   * geometry, like an X-ray. Still a single draw call, so this costs
   * nothing extra.
   * @default false
   */
  xray?: boolean;
  /**
   * Renders a dashed line via `THREE.LineDashedMaterial` (a
   * `LineBasicMaterial` subclass, so `setColor`/`setOpacity`/`setXray` need
   * no special-casing). Dash/gap size scale with the target's bounding
   * sphere, not a caller-facing knob. Typical use: a peer's hover
   * indicator, distinguished from a solid selection ring.
   * @default false
   */
  dashed?: boolean;
}

/**
 * Non-destructive outline overlay for a single mesh, built once from
 * `target.geometry` via `THREE.EdgesGeometry` and added as a child of
 * `target` - never mutates the target's own material. Several instances can
 * coexist on the same target (e.g. one per peer that has it selected)
 * without conflicting, unlike recoloring the mesh's own material in place.
 */
export class SelectionOutline extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  constructor(
    options: SelectionOutlineOptions
  ) {
    const {
      target, color = "#ffffff", opacity = 1, linewidth = 1, xray = false, dashed = false
    } = options;

    target.geometry.computeBoundingSphere();
    const radius = target.geometry.boundingSphere?.radius ?? 1;
    const offset = radius * kOffsetFactor;
    const geometry = inflateEdgesGeometry(target.geometry, offset);

    const material = dashed ?
      new THREE.LineDashedMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        linewidth,
        depthTest: !xray,
        depthWrite: !xray,
        dashSize: radius * kDashSizeFactor,
        gapSize: radius * kGapSizeFactor
      }) :
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        linewidth,
        depthTest: !xray,
        depthWrite: !xray
      });

    super(geometry, material);

    // `computeLineDistances` is a `THREE.Line`/`LineSegments` instance
    // method (it reads `this.geometry`), not a `BufferGeometry` one - only
    // callable after `super()`.
    if (dashed) {
      this.computeLineDistances();
    }

    this.renderOrder = xray ? kXrayRenderOrder : 1;
    target.add(this);
  }

  setColor(
    color: THREE.ColorRepresentation
  ): void {
    this.material.color.set(color);
  }

  setOpacity(
    opacity: number
  ): void {
    this.material.opacity = opacity;
    this.material.transparent = opacity < 1;
  }

  /**
   * Updates the outline material's `linewidth` - see
   * `SelectionOutlineOptions.linewidth` for platform caveats.
   */
  setLinewidth(
    linewidth: number
  ): void {
    this.material.linewidth = linewidth;
  }

  /**
   * Toggles depth-test/write and render order between the normal and X-ray
   * behavior described on `SelectionOutlineOptions.xray`.
   */
  setXray(
    xray: boolean
  ): void {
    this.material.depthTest = !xray;
    this.material.depthWrite = !xray;
    this.renderOrder = xray ? kXrayRenderOrder : 1;
  }

  dispose(): void {
    this.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
