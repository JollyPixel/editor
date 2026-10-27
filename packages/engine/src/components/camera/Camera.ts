// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../actor/ActorComponent.ts";
import type { Actor } from "../../actor/Actor.ts";
import type {
  RenderComponent,
  RenderViewport
} from "../../systems/rendering/Renderer.ts";
import type {
  PostProcessing
} from "../../systems/rendering/compositing/PostProcessing.ts";
import type { WorldDefaultContext } from "../../systems/World.ts";

export type CameraProjectionMode = "perspective" | "orthographic";

export interface CameraOptions {
  projectionMode?: CameraProjectionMode;
  /**
   * Perspective FOV in degrees.
   * @default 45
   */
  fov?: number;
  /**
   * Near clipping plane.
   * @default 0.1
   */
  near?: number;
  /**
   * Far clipping plane.
   * @default 10000
   */
  far?: number;
  /**
   * Ortho mode half-height in world units.
   * @default 1
   */
  orthographicScale?: number;
  /**
   * Normalized viewport rect. null = full canvas.
   * @default null
   */
  viewport?: RenderViewport | null;
  /**
   * Render depth/order. Lower = rendered first.
   * @default 0
   */
  depth?: number;
  /**
   * Whether to automatically add a THREE.AudioListener to the camera for 3D audio.
   * @default false
   */
  addAudioListener?: boolean;
  /**
   * Builds the output node the camera renders through.
   * @default null
   */
  postProcessing?: PostProcessing | null;
  /**
   * Registers the camera with the renderer. A camera that does not render
   * keeps its projection settings without drawing the scene.
   * @default true
   */
  render?: boolean;
}

export type CameraSettings = Pick<
  CameraOptions,
  | "projectionMode"
  | "fov"
  | "near"
  | "far"
  | "orthographicScale"
  | "viewport"
  | "depth"
>;

export const CAMERA_DEFAULTS = {
  projectionMode: "perspective",
  fov: 45,
  near: 0.1,
  far: 10000,
  orthographicScale: 1,
  viewport: null,
  depth: 0,
  addAudioListener: false,
  postProcessing: null,
  render: true
} as const satisfies Required<CameraOptions>;

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
  #postProcessing: PostProcessing | null;
  #render: boolean;

  #projectionDirty = true;
  #lastCanvasWidth = 0;
  #lastCanvasHeight = 0;

  #worldPosition = new THREE.Vector3();
  #worldQuaternion = new THREE.Quaternion();
  #worldScale = new THREE.Vector3();

  get threeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#threeCamera;
  }

  get depth(): number {
    return this.#depth;
  }

  get viewport(): RenderViewport | null {
    return this.#viewport;
  }

  get postProcessing(): PostProcessing | null {
    return this.#postProcessing;
  }

  set postProcessing(
    postProcessing: PostProcessing | null
  ) {
    this.#postProcessing = postProcessing;
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
      projectionMode = CAMERA_DEFAULTS.projectionMode,
      fov = CAMERA_DEFAULTS.fov,
      near = CAMERA_DEFAULTS.near,
      far = CAMERA_DEFAULTS.far,
      orthographicScale = CAMERA_DEFAULTS.orthographicScale,
      viewport = CAMERA_DEFAULTS.viewport,
      depth = CAMERA_DEFAULTS.depth,
      addAudioListener = CAMERA_DEFAULTS.addAudioListener,
      postProcessing = CAMERA_DEFAULTS.postProcessing,
      render = CAMERA_DEFAULTS.render
    } = options;

    this.#projectionMode = projectionMode;
    this.#fov = fov;
    this.#near = near;
    this.#far = far;
    this.#orthographicScale = orthographicScale;
    this.#viewport = viewport;
    this.#depth = depth;
    this.#postProcessing = postProcessing;
    this.#render = render;

    this.#threeCamera = this.#createThreeCamera();
    if (addAudioListener) {
      this.threeCamera.add(actor.world.audio.threeAudioListener);
    }
  }

  #createThreeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    const camera = this.#projectionMode === "orthographic"
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, this.#near, this.#far)
      : new THREE.PerspectiveCamera(this.#fov, 1, this.#near, this.#far);
    camera.matrixWorldAutoUpdate = false;

    return camera;
  }

  awake(): void {
    if (!this.#render) {
      return;
    }

    const { renderer } = this.actor.world;
    renderer.addRenderComponent(this);
    this.addTeardown(() => renderer.removeRenderComponent(this));
  }

  prepareRender(
    canvasWidth: number,
    canvasHeight: number
  ): void {
    this.actor.object3D.updateWorldMatrix(true, false);
    this.#threeCamera.matrixWorld.copy(
      this.actor.object3D.matrixWorld
    );
    this.#threeCamera.matrixWorldInverse
      .copy(this.#threeCamera.matrixWorld)
      .invert();

    this.#threeCamera.matrixWorld.decompose(
      this.#worldPosition,
      this.#worldQuaternion,
      this.#worldScale
    );
    this.#threeCamera.position.copy(this.#worldPosition);
    this.#threeCamera.quaternion.copy(this.#worldQuaternion);
    this.#threeCamera.scale.copy(this.#worldScale);

    for (const child of this.#threeCamera.children) {
      child.updateMatrixWorld(true);
    }

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

  configure(
    settings: CameraSettings
  ): this {
    const {
      projectionMode = this.#projectionMode,
      fov = this.#fov,
      near = this.#near,
      far = this.#far,
      orthographicScale = this.#orthographicScale,
      viewport = this.#viewport,
      depth = this.#depth
    } = settings;

    this.#fov = fov;
    this.#near = near;
    this.#far = far;
    this.#orthographicScale = orthographicScale;
    this.#viewport = viewport;
    this.#depth = depth;
    if (projectionMode !== this.#projectionMode) {
      this.#switchProjection(projectionMode);
    }
    this.#projectionDirty = true;

    return this;
  }

  #switchProjection(
    mode: CameraProjectionMode
  ): void {
    const previous = this.#threeCamera;
    this.#projectionMode = mode;
    this.#threeCamera = this.#createThreeCamera();

    if (previous.children.length > 0) {
      this.#threeCamera.add(...previous.children);
    }
    this.#threeCamera.layers.mask = previous.layers.mask;
  }
}
