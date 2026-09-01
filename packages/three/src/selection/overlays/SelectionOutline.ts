// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { inflateEdgesGeometry } from "./inflateEdgesGeometry.ts";

// CONSTANTS
// Edges sit exactly on the target's own surface, so identical depth values
// z-fight with the mesh's triangles at that seam (visible as a dashed/flickering
// line). `glPolygonOffset` doesn't apply to GL_LINES, so nudge every edge
// vertex slightly outward instead, along its own local surface normal
// (`inflateEdgesGeometry`) rather than a uniform `object.scale` bump - see
// that function's own doc comment for why the distinction matters on a
// torus/torus knot's concave-relative-to-origin regions. Expressed as a
// fraction of the target's own bounding-sphere radius, not an absolute
// distance, so it reads the same regardless of the mesh's actual size.
const kOffsetFactor = 0.006;
// Draws after every default-renderOrder object, so an `xray` outline
// reliably wins the pixel even though it skips the depth test - depth alone
// would only make it "win" against geometry rendered earlier in the same
// frame, not geometry drawn afterward.
const kXrayRenderOrder = 999;

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
   * Line thickness in (CSS) pixels, forwarded straight to
   * `THREE.LineBasicMaterial.linewidth`. Most WebGL backends silently clamp
   * this to 1 regardless of the value given - a long-standing ANGLE/GL_LINES
   * driver limitation `LineBasicMaterial` does nothing to work around - so a
   * value above 1 is a "nice if the platform honors it" upgrade, not a
   * guarantee; `WebGPURenderer` is not affected.
   * @default 1
   */
  linewidth?: number;
  /**
   * Skips the depth test (and depth write) so the outline stays visible
   * through any geometry in front of it, like an X-ray, instead of being
   * occluded like a normal object - handy for keeping a selection visible
   * through walls or a crowded scene. Still a single draw call either way,
   * so this doesn't cost anything extra to render.
   * @default false
   */
  xray?: boolean;
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
    const { target, color = "#ffffff", opacity = 1, linewidth = 1, xray = false } = options;

    target.geometry.computeBoundingSphere();
    const offset = (target.geometry.boundingSphere?.radius ?? 1) * kOffsetFactor;

    super(
      inflateEdgesGeometry(target.geometry, offset),
      new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        linewidth,
        depthTest: !xray,
        depthWrite: !xray
      })
    );

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
   * Updates the outline material's `linewidth` - see this option's own doc
   * comment on `SelectionOutlineOptions` for why this is not guaranteed to
   * have a visible effect on every platform.
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
