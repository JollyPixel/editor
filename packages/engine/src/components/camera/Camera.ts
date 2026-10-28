// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ActorComponent } from "../../actor/ActorComponent.ts";
import type { Actor } from "../../actor/Actor.ts";
import type { RenderComponent } from "../../systems/rendering/Renderer.ts";
import { CanvasDimensions } from "../../systems/rendering/CanvasDimensions.ts";
import {
  type RenderViewport,
  Viewport
} from "../../systems/rendering/Viewport.ts";
import type {
  PostProcessing
} from "../../systems/rendering/compositing/PostProcessing.ts";
import type { WorldDefaultContext } from "../../systems/World.ts";
import {
  type CameraProjection,
  type CameraProjectionMode,
  createCameraProjection
} from "./CameraProjection.ts";

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

export type ResolvedCameraSettings = Required<
  Omit<CameraSettings, "viewport">
> & {
  viewport: Viewport | null;
};

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
  postProcessing: PostProcessing | null;

  #settings: ResolvedCameraSettings;
  #projection: CameraProjection;
  #render: boolean;
  #canvas = CanvasDimensions.empty;

  #worldPosition = new THREE.Vector3();
  #worldQuaternion = new THREE.Quaternion();
  #worldScale = new THREE.Vector3();

  constructor(
    actor: Actor<TContext>,
    options: CameraOptions = {}
  ) {
    super({
      actor,
      typeName: "Camera"
    });

    const {
      addAudioListener = CAMERA_DEFAULTS.addAudioListener,
      postProcessing = CAMERA_DEFAULTS.postProcessing,
      render = CAMERA_DEFAULTS.render
    } = options;

    this.#settings = resolveSettings(CAMERA_DEFAULTS, options);
    this.postProcessing = postProcessing;
    this.#render = render;

    this.#projection = createCameraProjection(this.#settings.projectionMode);
    this.#writeProjection();
    if (addAudioListener) {
      this.threeCamera.add(actor.world.audio.threeAudioListener);
    }
  }

  get threeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.#projection.camera;
  }

  get projection(): CameraProjection {
    return this.#projection;
  }

  get settings(): Readonly<ResolvedCameraSettings> {
    return this.#settings;
  }

  get depth(): number {
    return this.#settings.depth;
  }

  get viewport(): Viewport | null {
    return this.#settings.viewport;
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
    canvas: CanvasDimensions
  ): void {
    const camera = this.threeCamera;

    this.actor.object3D.updateWorldMatrix(true, false);
    camera.matrixWorld.copy(this.actor.object3D.matrixWorld);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    camera.matrixWorld.decompose(
      this.#worldPosition,
      this.#worldQuaternion,
      this.#worldScale
    );
    camera.position.copy(this.#worldPosition);
    camera.quaternion.copy(this.#worldQuaternion);
    camera.scale.copy(this.#worldScale);

    for (const child of camera.children) {
      child.updateMatrixWorld(true);
    }

    if (!canvas.equals(this.#canvas)) {
      this.#canvas = canvas;
      this.#writeProjection();
    }
  }

  configure(
    settings: CameraSettings
  ): this {
    const previous = this.#settings;
    this.#settings = resolveSettings(previous, settings);

    if (this.#settings.projectionMode !== previous.projectionMode) {
      this.#switchProjection();
    }
    this.#writeProjection();

    return this;
  }

  #writeProjection(): void {
    const { viewport } = this.#settings;
    const aspect = this.#canvas.isEmpty ?
      1 :
      (viewport ?? Viewport.full).aspect(this.#canvas);

    this.#projection.write(this.#settings, aspect);
  }

  #switchProjection(): void {
    const previous = this.threeCamera;
    this.#projection = createCameraProjection(this.#settings.projectionMode);

    if (previous.children.length > 0) {
      this.threeCamera.add(...previous.children);
    }
    this.threeCamera.layers.mask = previous.layers.mask;
  }
}

function resolveSettings(
  current: Readonly<ResolvedCameraSettings>,
  settings: CameraSettings
): ResolvedCameraSettings {
  const {
    projectionMode = current.projectionMode,
    fov = current.fov,
    near = current.near,
    far = current.far,
    orthographicScale = current.orthographicScale,
    viewport = current.viewport,
    depth = current.depth
  } = settings;

  return {
    projectionMode,
    fov,
    near,
    far,
    orthographicScale,
    viewport: viewport === null || viewport instanceof Viewport ?
      viewport :
      new Viewport(viewport),
    depth
  };
}
