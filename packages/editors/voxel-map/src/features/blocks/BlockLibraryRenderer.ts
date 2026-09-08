// Import Third-party Dependencies
import * as THREE from "three";
import { disposeObject3D } from "@jolly-pixel/engine";
import {
  buildShapeGeometry,
  tileRefForSlot,
  type ResolvedBlockDefinition,
  type BlockShapeRegistry,
  type TilesetManager,
  type TilesetUVRegion
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  computeBlockGridLayout,
  type BlockGridLayout
} from "./blockGridLayout.ts";

// CONSTANTS
// Extra resolution keeps cube silhouettes smooth after MSAA resolves.
const kSuperSampling = 2;
const kMaxPixelRatio = 3;
const kCameraFov = 45;
const kCameraZ = 2.2;
const kAmbientIntensity = 1.5;
const kDirIntensity = 1.2;
const kFitFactor = 0.78;
const kFitRadius = Math.tan((kCameraFov * Math.PI) / 360) *
  kCameraZ * kFitFactor;

export interface CellEntry {
  blockId: number;
  block: ResolvedBlockDefinition;
  mesh: THREE.Mesh | THREE.Group;
  x: number;
  y: number;
}

export interface BlockLibraryRendererOptions {
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  blocks?: ResolvedBlockDefinition[];
}

function fitGeometry(
  geometry: THREE.BufferGeometry
): void {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere === null || sphere.radius <= 0) {
    return;
  }

  const { center, radius } = sphere;
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(
    kFitRadius / radius,
    kFitRadius / radius,
    kFitRadius / radius
  );
}

export class BlockLibraryRenderer {
  readonly canvas: HTMLCanvasElement;
  onLayoutChange: (() => void) | null = null;

  #renderer: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #cells: CellEntry[] = [];
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;
  #raf = -1;
  #rot = 0;
  #cols = 1;
  #cellSize = 1;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #layoutDirty = true;
  #container: HTMLElement;
  #resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    options: BlockLibraryRendererOptions
  ) {
    this.#shapeRegistry = options.shapeRegistry;
    this.#tilesetManager = options.tilesetManager;
    this.#container = container;

    this.#renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true
    });
    this.#renderer.setPixelRatio(
      Math.min(window.devicePixelRatio * kSuperSampling, kMaxPixelRatio)
    );
    this.#renderer.autoClear = false;
    this.#renderer.setClearColor(0x000000, 0);

    this.canvas = this.#renderer.domElement;
    this.canvas.style.display = "block";
    container.appendChild(this.canvas);

    this.#scene = new THREE.Scene();
    this.#scene.add(new THREE.AmbientLight(0xffffff, kAmbientIntensity));
    const dir = new THREE.DirectionalLight(0xffffff, kDirIntensity);
    dir.position.set(3, 5, 3);
    this.#scene.add(dir);

    this.#camera = new THREE.PerspectiveCamera(kCameraFov, 1, 0.1, 20);
    this.#camera.position.set(0, 0, kCameraZ);

    this.#resizeObserver = new ResizeObserver(() => {
      this.#layoutDirty = true;
    });
    this.#resizeObserver.observe(container);

    if (options.blocks) {
      this.setBlocks(options.blocks);
    }

    this.#startLoop();
  }

  setBlocks(
    blocks: ResolvedBlockDefinition[]
  ): void {
    const previous = new Map(
      this.#cells.map((cell) => [cell.blockId, cell])
    );
    const next: CellEntry[] = [];

    for (const block of blocks) {
      const existing = previous.get(block.id);
      if (existing?.block === block) {
        previous.delete(block.id);
        next.push(existing);

        continue;
      }

      if (existing) {
        this.#removeCell(existing);
        previous.delete(block.id);
      }

      const mesh = this.#buildBlockMesh(block);
      mesh.visible = false;
      this.#scene.add(mesh);
      next.push({ blockId: block.id, block, mesh, x: 0, y: 0 });
    }

    for (const cell of previous.values()) {
      this.#removeCell(cell);
    }

    this.#cells = next;
    this.#relayout();
  }

  get layout(): BlockGridLayout {
    return {
      cols: this.#cols,
      cellSize: this.#cellSize
    };
  }

  getBlockAtPointer(
    px: number,
    py: number
  ): number | null {
    const col = Math.floor(px / this.#cellSize);
    const row = Math.floor(py / this.#cellSize);

    const cell = this.#cells.find(
      (cell) => cell.x === col && cell.y === row
    );

    return cell?.blockId ?? null;
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    for (const cell of this.#cells) {
      this.#removeCell(cell);
    }
    this.#cells = [];
    this.#renderer.dispose();
    this.canvas.remove();
  }

  #buildBlockMesh(
    block: ResolvedBlockDefinition
  ): THREE.Mesh | THREE.Group {
    const shape = this.#shapeRegistry.get(block.shapeId);
    if (!shape) {
      const fallback = new THREE.BoxGeometry(1, 1, 1);
      fitGeometry(fallback);

      return new THREE.Mesh(
        fallback,
        new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
      );
    }

    const tilesetId =
      block.defaultTexture?.tilesetId ??
      this.#tilesetManager.defaultTilesetId ??
      undefined;
    const texture = this.#tilesetManager.has(tilesetId) ?
      this.#tilesetManager.atlas(tilesetId).texture :
      null;
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.FrontSide,
      alphaTest: 0.1
    });

    const { positions, normals, uvs, indices, ranges } = buildShapeGeometry(
      shape
    );

    const vertices = Float32Array.from(positions);
    const atlasUvs = Float32Array.from(uvs);

    for (const range of ranges) {
      const tileRef = tileRefForSlot(block, range.slot);
      if (!tileRef || !texture) {
        continue;
      }

      let region: TilesetUVRegion;
      try {
        region = this.#tilesetManager
          .atlas(tileRef.tilesetId)
          .uvFor(tileRef.col, tileRef.row);
      }
      catch {
        // A missing tile region falls back to the full texture.
        continue;
      }

      const end = range.start + range.count;
      for (let index = range.start; index < end; index++) {
        atlasUvs[index * 2] = region.offsetU +
          (atlasUvs[index * 2] * region.scaleU);
        atlasUvs[(index * 2) + 1] = region.offsetV +
          (atlasUvs[(index * 2) + 1] * region.scaleV);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(atlasUvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    fitGeometry(geo);

    return new THREE.Mesh(geo, mat);
  }

  #relayout(): void {
    this.#layoutDirty = false;

    const style = getComputedStyle(this.#container);
    const paddingH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const layout = computeBlockGridLayout(
      this.#container.clientWidth - paddingH
    );

    const changed = layout.cols !== this.#cols ||
      layout.cellSize !== this.#cellSize;
    this.#cols = layout.cols;
    this.#cellSize = layout.cellSize;

    for (let i = 0; i < this.#cells.length; i++) {
      this.#cells[i].x = i % this.#cols;
      this.#cells[i].y = Math.floor(i / this.#cols);
    }

    if (changed) {
      this.onLayoutChange?.();
    }
  }

  #syncCanvasSize(): void {
    const rows = Math.ceil(this.#cells.length / this.#cols) || 1;
    const width = this.#cols * this.#cellSize;
    const height = rows * this.#cellSize;
    if (
      width === this.#canvasWidth &&
      height === this.#canvasHeight
    ) {
      return;
    }

    this.#canvasWidth = width;
    this.#canvasHeight = height;
    this.#renderer.setSize(width, height, false);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  #startLoop(): void {
    const loop = () => {
      this.#raf = requestAnimationFrame(loop);
      this.#render();
    };
    this.#raf = requestAnimationFrame(loop);
  }

  #render(): void {
    if (this.#layoutDirty) {
      this.#relayout();
    }
    this.#syncCanvasSize();
    if (
      this.#canvasWidth === 0 ||
      this.#canvasHeight === 0
    ) {
      return;
    }

    this.#rot += 0.005;

    this.#renderer.clear();

    const totalRows = Math.ceil(this.#cells.length / this.#cols) || 1;
    const cellSize = this.#cellSize;

    const scrollTop = this.#container.scrollTop;
    const containerH = this.#container.clientHeight;

    for (const cell of this.#cells) {
      const cellTop = cell.y * cellSize;
      const cellBottom = cellTop + cellSize;
      if (cellBottom <= scrollTop || cellTop >= scrollTop + containerH) {
        continue;
      }

      cell.mesh.visible = true;
      cell.mesh.position.set(0, 0, 0);
      cell.mesh.rotation.set(0.4, this.#rot, 0);

      const x = cell.x * cellSize;
      const y = (totalRows - 1 - cell.y) * cellSize;

      this.#renderer.setViewport(x, y, cellSize, cellSize);
      this.#renderer.setScissor(x, y, cellSize, cellSize);
      this.#renderer.setScissorTest(true);
      this.#renderer.clearDepth();

      this.#renderer.render(this.#scene, this.#camera);

      cell.mesh.visible = false;
    }

    this.#renderer.setScissorTest(false);
  }

  #removeCell(cell: CellEntry): void {
    this.#scene.remove(cell.mesh);
    disposeObject3D(cell.mesh);
  }
}
