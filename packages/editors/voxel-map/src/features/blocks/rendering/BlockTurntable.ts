// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { BlockRenderSources } from "./BlockRenderSources.ts";
import {
  createBlockPreviewStage,
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
  #raf = -1;
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

    const stage = createBlockPreviewStage(this.renderer);
    this.#scene = stage.scene;
    this.#camera = stage.camera;
    this.meshes = new BlockPreviewMeshes(this.#scene, sources);

    this.#resizeObserver = new ResizeObserver(() => this.resized());
    this.#resizeObserver.observe(container);
    this.#raf = requestAnimationFrame(this.#loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
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
    mesh.visible = true;
    mesh.rotation.set(PREVIEW_TILT, this.#rotation, 0);
    this.renderer.render(this.#scene, this.#camera);
    mesh.visible = false;
  }

  readonly #loop = (time: number): void => {
    this.#raf = requestAnimationFrame(this.#loop);
    this.meshes.refresh(time);
    this.#rotation += PREVIEW_ROTATION_STEP;
    this.draw();
  };
}
