// Import Third-party Dependencies
import * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import type {
  BlockShapeRegistry,
  MaterialGroupList,
  ResolvedBlockDefinition,
  TilesetManager
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockPreviewMesh,
  createBlockPreviewStage,
  emptyTextureSlots,
  PREVIEW_ROTATION_STEP,
  PREVIEW_TILT,
  type BlockPreviewSources
} from "./blockPreviewMesh.ts";
import { TileOpacityProbe } from "./tileOpacity.ts";
import { WebGLContextLease } from "./WebGLContextLease.ts";

// CONSTANTS
const kSuperSampling = 2;
const kMaxPixelRatio = 3;
const kOpacityCheckIntervalMs = 250;

export interface BlockPreviewRendererOptions {
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  materialGroups?: MaterialGroupList;
}

export class BlockPreviewRenderer {
  readonly canvas: HTMLCanvasElement;
  onContextLost: (() => void) | null = null;

  #renderer: THREE.WebGLRenderer;
  #contextLease: WebGLContextLease;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #sources: BlockPreviewSources;
  #container: HTMLElement;
  #resizeObserver: ResizeObserver;
  #block: ResolvedBlockDefinition | null = null;
  #mesh: THREE.Mesh | null = null;
  #emptySlots = "";
  #opacityCheckAt = 0;
  #raf = -1;
  #rot = 0;
  #size = 0;
  #sizeDirty = true;
  #materialGroupsVersion = -1;

  constructor(
    container: HTMLElement,
    options: BlockPreviewRendererOptions
  ) {
    this.#container = container;
    this.#sources = {
      shapeRegistry: options.shapeRegistry,
      tilesetManager: options.tilesetManager,
      tileOpacity: new TileOpacityProbe(options.tilesetManager),
      materialGroups: options.materialGroups
    };
    this.#materialGroupsVersion = options.materialGroups?.version ?? -1;

    this.#renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.#renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * kSuperSampling, kMaxPixelRatio)
    );
    this.#renderer.setClearColor(0x000000, 0);
    this.#contextLease = new WebGLContextLease(this.#renderer);
    this.#contextLease.onLost = () => this.onContextLost?.();

    this.canvas = this.#renderer.domElement;
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    const stage = createBlockPreviewStage(this.#renderer);
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
    this.#buildMesh();
  }

  get block(): ResolvedBlockDefinition | null {
    return this.#block;
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    this.#removeMesh();
    this.#block = null;
    this.#contextLease.release();
    this.canvas.remove();
  }

  #buildMesh(): void {
    this.#removeMesh();
    const block = this.#block;
    if (block === null) {
      return;
    }

    this.#emptySlots = emptyTextureSlots(block, this.#sources).join(",");
    this.#mesh = buildBlockPreviewMesh(block, this.#sources);
    this.#scene.add(this.#mesh);
  }

  #refreshEmptySlots(): void {
    const block = this.#block;
    if (
      block !== null &&
      emptyTextureSlots(block, this.#sources).join(",") !== this.#emptySlots
    ) {
      this.#buildMesh();
    }
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
    const loop = (time: number) => {
      this.#raf = requestAnimationFrame(loop);
      this.#render(time);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  #render(
    time: number
  ): void {
    if (this.#sizeDirty) {
      this.#syncSize();
    }
    const groupsVersion = this.#sources.materialGroups?.version ?? -1;
    if (groupsVersion !== this.#materialGroupsVersion) {
      this.#materialGroupsVersion = groupsVersion;
      this.#buildMesh();
    }
    else if (time - this.#opacityCheckAt >= kOpacityCheckIntervalMs) {
      this.#opacityCheckAt = time;
      this.#refreshEmptySlots();
    }
    if (this.#size === 0 || this.#mesh === null) {
      return;
    }

    this.#rot += PREVIEW_ROTATION_STEP;
    this.#mesh.rotation.set(PREVIEW_TILT, this.#rot, 0);
    this.#renderer.render(this.#scene, this.#camera);
  }
}
