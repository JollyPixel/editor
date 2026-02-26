// Import Third-party Dependencies
import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { ActorComponent, Actor } from "@jolly-pixel/engine";

export interface GridRendererOptions {
  extent?: number;
  /**
   * Spacing in voxels between the white major grid lines.
   * @default 8
   **/
  blockSize?: number;
  /**
   * Color of the major grid lines.
   * @default white
   **/
  lineColor?: THREE.ColorRepresentation;
  /**
   * Color of the per-voxel cross markers.
   * @default light blue
   **/
  crossColor?: THREE.ColorRepresentation;
  /**
   * Width of the major grid lines in CSS pixels.
   * @default 1.5
   **/
  lineWidth?: number;
  /**
   * Width of the cross marker lines in CSS pixels.
   * @default 1
   **/
  crossWidth?: number;
  /**
   * Half-length of each cross arm in voxel units.
   * @default 0.1
   **/
  crossSize?: number;
  /**
   * Distance from the camera (world units) where fading begins.
   * @default 20
   */
  fadeNear?: number;
  /**
   * Distance from the camera (world units) where the grid is fully transparent.
   * @default 50
   */
  fadeFar?: number;
}

/**
 * Renders a voxel editor floor grid on Y=0 using LineSegments2 (fat lines).
 *
 * - White lines every `blockSize` voxels form the coarse block grid.
 * - Light-blue cross markers at every 1-unit junction sit inside each cell.
 */
export class GridRenderer extends ActorComponent {
  #extent: number;
  #blockSize: number;
  #lineColor: THREE.ColorRepresentation;
  #crossColor: THREE.ColorRepresentation;
  #lineWidth: number;
  #crossWidth: number;
  #crossSize: number;

  #fadeNear: number;
  #fadeFar: number;

  #gridMesh: LineSegments2 | null = null;
  #crossMesh: LineSegments2 | null = null;

  constructor(
    actor: Actor,
    options: GridRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "GridRenderer"
    });

    const {
      extent = 32,
      blockSize = 8,
      lineColor = new THREE.Color("#90A4AE"),
      crossColor = new THREE.Color("#ECEFF1"),
      lineWidth = 1.5,
      crossWidth = 1,
      crossSize = 0.1,
      fadeNear = 20,
      fadeFar = 50
    } = options;

    this.#extent = extent;
    this.#blockSize = blockSize;
    this.#lineColor = lineColor;
    this.#crossColor = crossColor;
    this.#lineWidth = lineWidth;
    this.#crossWidth = crossWidth;
    this.#crossSize = crossSize;
    this.#fadeNear = fadeNear;
    this.#fadeFar = fadeFar;
    this.#build();

    this.actor.world.renderer.on("resize", ({ width, height }) => {
      this.setResolution(width, height);
    });
  }

  setExtent(
    value: number
  ): void {
    this.#extent = value;
    this.#clear();
    this.#build();
  }

  setVisible(
    value: boolean
  ): void {
    if (this.#gridMesh) {
      this.#gridMesh.visible = value;
    }
    if (this.#crossMesh) {
      this.#crossMesh.visible = value;
    }
  }

  /** Update the viewport resolution so LineMaterial renders at the correct pixel width. */
  setResolution(
    width: number,
    height: number
  ): void {
    this.#gridMesh?.material.resolution.set(width, height);
    this.#crossMesh?.material.resolution.set(width, height);
  }

  override destroy(): void {
    this.#clear();
    super.destroy();
  }

  #build(): void {
    this.#buildGrid();
    this.#buildCrosses();
  }

  #buildGrid(): void {
    const e = this.#extent;
    const bs = this.#blockSize;
    const positions: number[] = [];

    for (let i = -e; i <= e; i += bs) {
      // Line parallel to X axis
      positions.push(-e, 0, i, e, 0, i);
      // Line parallel to Z axis
      positions.push(i, 0, -e, i, 0, e);
    }

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);

    const mat = new LineMaterial({
      color: this.#lineColor,
      linewidth: this.#lineWidth,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });
    this.#applyFade(mat);

    this.#gridMesh = new LineSegments2(geo, mat);
    this.#gridMesh.renderOrder = -1;
    this.actor.addChildren(this.#gridMesh);
  }

  #buildCrosses(): void {
    const extent = this.#extent;
    const size = this.#crossSize;
    const positions: number[] = [];

    // Small + marker at every integer voxel junction that does NOT lie on a
    // white grid line (i.e. strictly inside each block cell).
    // Y=0.001 avoids z-fighting with the grid plane.
    for (let ix = -extent; ix <= extent; ix++) {
      if ((ix + extent) % this.#blockSize === 0) {
        continue;
      }
      for (let iz = -extent; iz <= extent; iz++) {
        if ((iz + extent) % this.#blockSize === 0) {
          continue;
        }
        // Arm along X
        positions.push(ix - size, 0.001, iz, ix + size, 0.001, iz);
        // Arm along Z
        positions.push(ix, 0.001, iz - size, ix, 0.001, iz + size);
      }
    }

    const geo = new LineSegmentsGeometry();
    geo.setPositions(positions);

    const mat = new LineMaterial({
      color: this.#crossColor,
      linewidth: this.#crossWidth,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight)
    });
    this.#applyFade(mat);

    this.#crossMesh = new LineSegments2(geo, mat);
    this.#crossMesh.renderOrder = -1;
    this.actor.addChildren(this.#crossMesh);
  }

  #applyFade(
    material: LineMaterial
  ): void {
    material.transparent = true;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFadeNear = { value: this.#fadeNear };
      shader.uniforms.uFadeFar = { value: this.#fadeFar };

      // --- Vertex shader ---
      // Inject a varying that carries the view-space distance to the line
      // midpoint. `start` and `end` are already in camera space (always
      // computed, regardless of WORLD_UNITS), so this works in both modes.
      shader.vertexShader = shader.vertexShader.replace(
        "void main() {",
        "varying float vViewDist;\nvoid main() {"
      );
      shader.vertexShader = shader.vertexShader.replace(
        "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );",
        "vec4 end = modelViewMatrix * vec4( instanceEnd, 1.0 );\nvViewDist = length( mix( start.xyz, end.xyz, 0.5 ) );"
      );

      // --- Fragment shader ---
      shader.fragmentShader = shader.fragmentShader.replace(
        "void main() {",
        "varying float vViewDist;\nuniform float uFadeNear;\nuniform float uFadeFar;\nvoid main() {"
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "gl_FragColor = vec4( diffuseColor.rgb, alpha );",
        [
          "float _fadeAlpha = 1.0 - smoothstep( uFadeNear, uFadeFar, vViewDist );",
          "gl_FragColor = vec4( diffuseColor.rgb, alpha * _fadeAlpha );"
        ].join("\n")
      );
    };
  }

  #clear(): void {
    if (this.#gridMesh) {
      this.actor.removeChildren(this.#gridMesh);
      this.#gridMesh = null;
    }
    if (this.#crossMesh) {
      this.actor.removeChildren(this.#crossMesh);
      this.#crossMesh = null;
    }
  }
}
