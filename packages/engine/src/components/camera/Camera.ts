// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { ActorComponent } from "../../actor/ActorComponent.ts";
import type { Actor } from "../../actor/Actor.ts";
import type {
  RenderComponent,
  RenderViewport
} from "../../systems/rendering/Renderer.ts";
import type { WorldDefaultContext } from "../../systems/World.ts";

// CONSTANTS
export type CameraProjectionMode = "perspective" | "orthographic";

export interface CameraOptions {
  projectionMode?: CameraProjectionMode;
  /**
   * Perspective FOV in degrees.
   * @default 45
   **/
  fov?: number;
  /** Near clipping plane.
   * @default 0.1
   **/
  near?: number;
  /** Far clipping plane.
   * @default 10000
   **/
  far?: number;
  /** Ortho mode half-height in world units.
   * @default 1
   **/
  orthographicScale?: number;
  /** Normalized viewport rect. null = full canvas.
   * @default null
   **/
  viewport?: RenderViewport | null;
  /** Render depth/order. Lower = rendered first.
   * @default 0
   **/
  depth?: number;
  /**
   * Whether to automatically add a THREE.AudioListener to the camera for 3D audio.
   * @default false
   */
  addAudioListener?: boolean;
}

export class CameraComponent<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> implements RenderComponent {
  #threeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  #projectionMode: CameraProjectionMode;
  #fov: number;
  #near: number;
  #far: number;
  #orthographicScale: number;
  #viewport: RenderViewport | null;
  #depth: number;

  #projectionDirty = true;
  #lastCanvasWidth = 0;
  #lastCanvasHeight = 0;

  get threeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#threeCamera;
  }

  get depth(): number {
    return this.#depth;
  }

  get viewport(): RenderViewport | null {
    return this.#viewport;
  }

  get projectionMode(): CameraProjectionMode {
    return this.#projectionMode;
  }

  get fov(): number {
    return this.#fov;
  }

  get near(): number {
    return this.#near;
  }

  get far(): number {
    return this.#far;
  }

  get orthographicScale(): number {
    return this.#orthographicScale;
  }

  constructor(
    actor: Actor<TContext>,
    options: CameraOptions = {}
  ) {
    super({
      actor,
      typeName: "Camera"
    });

    const {
      projectionMode = "perspective",
      fov = 45,
      near = 0.1,
      far = 10000,
      orthographicScale = 1,
      viewport = null,
      depth = 0,
      addAudioListener = false
    } = options;

    this.#projectionMode = projectionMode;
    this.#fov = fov;
    this.#near = near;
    this.#far = far;
    this.#orthographicScale = orthographicScale;
    this.#viewport = viewport;
    this.#depth = depth;

    this.#threeCamera = this.#projectionMode === "orthographic"
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, this.#near, this.#far)
      : new THREE.PerspectiveCamera(this.#fov, 1, this.#near, this.#far);
    if (addAudioListener) {
      this.threeCamera.add(actor.world.audio.threeAudioListener);
    }
  }

  awake(): void {
    this.actor.world.renderer.addRenderComponent(this);
  }

  /**
   * Called by RenderStrategy every frame before draw.
   * Syncs transform + updates projection.
   **/
  prepareRender(
    canvasWidth: number,
    canvasHeight: number
  ): void {
    // Sync camera world transform from actor's scene graph
    this.actor.object3D.updateWorldMatrix(true, false);
    this.#threeCamera.matrixWorld.copy(
      this.actor.object3D.matrixWorld
    );
    this.#threeCamera.matrixWorldInverse
      .copy(this.#threeCamera.matrixWorld)
      .invert();

    // Update projection when canvas resizes or settings changed
    const canvasChanged = canvasWidth !== this.#lastCanvasWidth ||
      canvasHeight !== this.#lastCanvasHeight;
    if (this.#projectionDirty || canvasChanged) {
      this.#lastCanvasWidth = canvasWidth;
      this.#lastCanvasHeight = canvasHeight;
      this.#updateProjection(canvasWidth, canvasHeight);
      this.#projectionDirty = false;
    }
  }

  #updateProjection(
    canvasWidth: number,
    canvasHeight: number
  ): void {
    const viewport = this.#viewport;
    const effectiveWidth = viewport ? viewport.width * canvasWidth : canvasWidth;
    const effectiveHeight = viewport ? viewport.height * canvasHeight : canvasHeight;
    const aspect = effectiveWidth / Math.max(effectiveHeight, 1);

    if (this.#threeCamera instanceof THREE.PerspectiveCamera) {
      this.#threeCamera.fov = this.#fov;
      this.#threeCamera.aspect = aspect;
      this.#threeCamera.near = this.#near;
      this.#threeCamera.far = this.#far;
    }
    else {
      const halfHeight = this.#orthographicScale;
      const halfWidth = halfHeight * aspect;
      this.#threeCamera.left = -halfWidth;
      this.#threeCamera.right = halfWidth;
      this.#threeCamera.top = halfHeight;
      this.#threeCamera.bottom = -halfHeight;
      this.#threeCamera.near = this.#near;
      this.#threeCamera.far = this.#far;
    }

    this.#threeCamera.updateProjectionMatrix();
  }

  setFov(
    fov: number
  ): this {
    this.#fov = fov;
    this.#projectionDirty = true;

    return this;
  }

  setNearFar(
    near: number,
    far: number
  ): this {
    this.#near = near;
    this.#far = far;
    this.#projectionDirty = true;

    return this;
  }

  setOrthographicScale(
    scale: number
  ): this {
    this.#orthographicScale = scale;
    this.#projectionDirty = true;

    return this;
  }

  setViewport(
    viewport: RenderViewport | null
  ): this {
    this.#viewport = viewport;
    this.#projectionDirty = true;

    return this;
  }

  setDepth(
    depth: number
  ): this {
    this.#depth = depth;

    return this;
  }

  setProjectionMode(
    mode: CameraProjectionMode
  ): this {
    if (mode === this.#projectionMode) {
      return this;
    }

    this.#projectionMode = mode;
    this.#threeCamera = mode === "orthographic"
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, this.#near, this.#far)
      : new THREE.PerspectiveCamera(this.#fov, 1, this.#near, this.#far);
    this.#projectionDirty = true;

    return this;
  }

  override destroy(): void {
    this.actor.world.renderer.removeRenderComponent(this);
    super.destroy();
  }
}
