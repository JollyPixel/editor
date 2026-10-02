// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import {
  createBlockPreviewStage,
  lightWithEnvironment,
  needsEnvironment,
  PREVIEW_ROTATION_STEP,
  PREVIEW_TILT
} from "./blockPreviewMesh.ts";
import { BlockPreviewMeshes } from "./BlockPreviewMeshes.ts";
import { WebGLContextLease } from "./WebGLContextLease.ts";

// CONSTANTS
const kSuperSampling = 2;
const kMaxPixelRatio = 3;

export class BlockTurntable {
  readonly canvas: HTMLCanvasElement;
  onContextLost: (() => void) | null = null;

  protected readonly container: HTMLElement;
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly meshes: BlockPreviewMeshes;
  readonly #scene: THREE.Scene;
  readonly #camera: THREE.PerspectiveCamera;
  readonly #contextLease: WebGLContextLease;
  readonly #resizeObserver: ResizeObserver;
  readonly #visibilityObserver: IntersectionObserver;
  #raf = -1;
  #visible = false;
  #lit = false;
  #rotation = 0;

  constructor(
    container: HTMLElement,
    sources: BlockRenderSources
  ) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * kSuperSampling, kMaxPixelRatio)
    );
    this.renderer.setClearColor(0x000000, 0);
    this.#contextLease = new WebGLContextLease(this.renderer);
    this.#contextLease.onLost = () => this.onContextLost?.();

    this.canvas = this.renderer.domElement;
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    const stage = createBlockPreviewStage();
    this.#scene = stage.scene;
    this.#camera = stage.camera;
    this.meshes = new BlockPreviewMeshes(this.#scene, sources);

    this.#resizeObserver = new ResizeObserver(() => this.resized());
    this.#resizeObserver.observe(container);
    this.#visibilityObserver = new IntersectionObserver(this.#onVisibility);
    this.#visibilityObserver.observe(container);
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    this.#visibilityObserver.disconnect();
    this.meshes.dispose();
    this.#contextLease.release();
    this.canvas.remove();
  }

  protected resized(): void {
    return void 0;
  }

  protected draw(): void {
    return void 0;
  }

  protected renderMesh(
    mesh: THREE.Mesh
  ): void {
    if (!this.#lit && needsEnvironment(mesh)) {
      lightWithEnvironment(this.#scene, this.renderer);
      this.#lit = true;
    }
    mesh.visible = true;
    mesh.rotation.set(PREVIEW_TILT, this.#rotation, 0);
    this.renderer.render(this.#scene, this.#camera);
    mesh.visible = false;
  }

  readonly #onVisibility = (
    entries: IntersectionObserverEntry[]
  ): void => {
    const visible = entries.at(-1)?.isIntersecting === true;
    if (visible === this.#visible) {
      return;
    }

    this.#visible = visible;
    cancelAnimationFrame(this.#raf);
    this.#raf = visible ? requestAnimationFrame(this.#loop) : -1;
  };

  readonly #loop = (time: number): void => {
    this.#raf = requestAnimationFrame(this.#loop);
    this.meshes.refresh(time);
    this.#rotation += PREVIEW_ROTATION_STEP;
    this.draw();
  };
}
