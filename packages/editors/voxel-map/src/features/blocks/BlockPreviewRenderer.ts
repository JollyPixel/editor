// Import Third-party Dependencies
import * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import type { ResolvedBlockDefinition } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockPreviewMesh,
  createBlockPreviewStage,
  PREVIEW_ROTATION_STEP,
  PREVIEW_TILT,
  type BlockPreviewSources
} from "./blockPreviewMesh.ts";

// CONSTANTS
const kSuperSampling = 2;
const kMaxPixelRatio = 3;

export class BlockPreviewRenderer {
  readonly canvas: HTMLCanvasElement;

  #renderer: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #sources: BlockPreviewSources;
  #container: HTMLElement;
  #resizeObserver: ResizeObserver;
  #block: ResolvedBlockDefinition | null = null;
  #mesh: THREE.Mesh | null = null;
  #raf = -1;
  #rot = 0;
  #size = 0;
  #sizeDirty = true;

  constructor(
    container: HTMLElement,
    sources: BlockPreviewSources
  ) {
    this.#container = container;
    this.#sources = sources;

    this.#renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.#renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * kSuperSampling, kMaxPixelRatio)
    );
    this.#renderer.setClearColor(0x000000, 0);

    this.canvas = this.#renderer.domElement;
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    const stage = createBlockPreviewStage();
    this.#scene = stage.scene;
    this.#camera = stage.camera;

    this.#resizeObserver = new ResizeObserver(() => {
      this.#sizeDirty = true;
    });
    this.#resizeObserver.observe(container);

    this.#startLoop();
  }

  set block(
    block: ResolvedBlockDefinition | null
  ) {
    if (block === this.#block) {
      return;
    }

    this.#block = block;
    this.#removeMesh();
    if (block === null) {
      return;
    }

    this.#mesh = buildBlockPreviewMesh(block, this.#sources);
    this.#scene.add(this.#mesh);
  }

  get block(): ResolvedBlockDefinition | null {
    return this.#block;
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    this.#removeMesh();
    this.#block = null;
    this.#renderer.dispose();
    this.canvas.remove();
  }

  #removeMesh(): void {
    if (this.#mesh === null) {
      return;
    }

    this.#scene.remove(this.#mesh);
    disposeObject3D(this.#mesh);
    this.#mesh = null;
  }

  #syncSize(): void {
    this.#sizeDirty = false;

    const size = Math.floor(
      Math.min(this.#container.clientWidth, this.#container.clientHeight)
    );
    if (size === this.#size) {
      return;
    }

    this.#size = size;
    this.#renderer.setSize(size, size, false);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }

  #startLoop(): void {
    const loop = () => {
      this.#raf = requestAnimationFrame(loop);
      this.#render();
    };
    this.#raf = requestAnimationFrame(loop);
  }

  #render(): void {
    if (this.#sizeDirty) {
      this.#syncSize();
    }
    if (this.#size === 0 || this.#mesh === null) {
      return;
    }

    this.#rot += PREVIEW_ROTATION_STEP;
    this.#mesh.rotation.set(PREVIEW_TILT, this.#rot, 0);
    this.#renderer.render(this.#scene, this.#camera);
  }
}
