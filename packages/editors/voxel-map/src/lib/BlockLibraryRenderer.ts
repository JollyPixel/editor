// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlockDefinition,
  BlockShapeRegistry,
  TilesetManager,
  FaceDefinition
} from "@jolly-pixel/voxel.renderer";

// CONSTANTS
// px per block preview cell
const kCellSize = 64;
const kCameraFov = 45;
const kCameraZ = 2.2;
const kAmbientIntensity = 1.5;
const kDirIntensity = 1.2;

export interface CellEntry {
  blockId: number;
  mesh: THREE.Mesh | THREE.Group;
  // cell column
  x: number;
  // cell row
  y: number;
}

export interface BlockLibraryRendererOptions {
  shapeRegistry: BlockShapeRegistry;
  tilesetManager: TilesetManager;
  blocks?: BlockDefinition[];
}

/**
 * Standalone Three.js renderer that draws a scrollable grid of block previews
 * inside a dedicated canvas. Uses scissor / viewport per cell.
 *
 * Usage:
 *   const r = new BlockLibraryRenderer(container, { shapeRegistry, tilesetManager, blocks });
 *   r.setBlocks(newBlocks);
 *   r.getBlockAtPointer(px, py); // → blockId | null
 */
export class BlockLibraryRenderer {
  readonly canvas: HTMLCanvasElement;

  #renderer: THREE.WebGLRenderer;
  #scene: THREE.Scene;
  #camera: THREE.PerspectiveCamera;
  #cells: CellEntry[] = [];
  #shapeRegistry: BlockShapeRegistry;
  #tilesetManager: TilesetManager;
  #selectedId: number | null = null;
  #raf = -1;
  #rot = 0;
  #cols = 1;
  // Adaptive cell size in device pixels — computed from available width
  #cellSize = kCellSize;
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
      antialias: false,
      alpha: true
    });
    this.#renderer.setPixelRatio(window.devicePixelRatio);
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

    this.#resizeObserver = new ResizeObserver(() => this.#relayout());
    this.#resizeObserver.observe(container);

    if (options.blocks) {
      this.setBlocks(options.blocks);
    }

    this.#startLoop();
  }

  setBlocks(
    blocks: BlockDefinition[]
  ): void {
    for (const cell of this.#cells) {
      this.#scene.remove(cell.mesh);
      if (cell.mesh instanceof THREE.Mesh) {
        cell.mesh.geometry.dispose();
      }
    }
    this.#cells = [];

    for (let i = 0; i < blocks.length; i++) {
      const mesh = this.#buildBlockMesh(blocks[i]);
      // Start hidden — each cell is made visible only during its own render pass
      // to prevent all meshes from overlapping at the origin simultaneously.
      mesh.visible = false;
      this.#scene.add(mesh);
      this.#cells.push({ blockId: blocks[i].id, mesh, x: 0, y: 0 });
    }

    this.#relayout();
  }

  getBlockAtPointer(
    px: number,
    py: number
  ): number | null {
    const pr = this.#renderer.getPixelRatio();
    const cellCssPx = this.#cellSize / pr;
    const col = Math.floor(px / cellCssPx);
    const row = Math.floor(py / cellCssPx);

    const cell = this.#cells.find(
      (cell) => cell.x === col && cell.y === row
    );

    return cell?.blockId ?? null;
  }

  setSelectedBlock(
    id: number | null
  ): void {
    this.#selectedId = id;
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    for (const cell of this.#cells) {
      this.#scene.remove(cell.mesh);
    }
    this.#cells = [];
    this.#renderer.dispose();
    this.canvas.remove();
  }

  #buildBlockMesh(
    block: BlockDefinition
  ): THREE.Mesh | THREE.Group {
    const shape = this.#shapeRegistry.get(block.shapeId);
    if (!shape) {
      return new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.8, 0.8),
        new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
      );
    }

    const tilesetId =
      block.defaultTexture?.tilesetId ??
      this.#tilesetManager.defaultTilesetId ??
      undefined;
    const texture = this.#tilesetManager.getTexture(tilesetId) ?? null;
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      side: THREE.FrontSide,
      alphaTest: 0.1
    });

    const allFaces = shape.faces as FaceDefinition[];
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vertOffset = 0;

    for (const face of allFaces) {
      const verts = face.vertices;
      const faceUvs = face.uvs;
      const n = face.normal;

      // Determine UV region for this face (use defaultTexture or first faceTexture)
      const tileRef =
        block.faceTextures[face.face as keyof typeof block.faceTextures] ??
        block.defaultTexture;
      let uOffset = 0;
      let vOffset = 0;
      let uScale = 1;
      let vScale = 1;

      if (tileRef && texture) {
        try {
          const region = this.#tilesetManager.getTileUV(tileRef);
          uOffset = region.offsetU;
          vOffset = region.offsetV;
          uScale = region.scaleU;
          vScale = region.scaleV;
        }
        catch {
          // No-op — region unavailable
        }
      }

      for (let vi = 0; vi < verts.length; vi++) {
        const v = verts[vi];
        positions.push(v[0] - 0.5, v[1] - 0.5, v[2] - 0.5);
        normals.push(n[0], n[1], n[2]);
        const u = faceUvs[vi];
        uvs.push(uOffset + u[0] * uScale, vOffset + u[1] * vScale);
      }

      if (verts.length === 4) {
        indices.push(
          vertOffset, vertOffset + 1, vertOffset + 2, vertOffset, vertOffset + 2, vertOffset + 3
        );
      }
      else {
        indices.push(vertOffset, vertOffset + 1, vertOffset + 2);
      }
      vertOffset += verts.length;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    return new THREE.Mesh(geo, mat);
  }

  #relayout(): void {
    const pr = this.#renderer.getPixelRatio();
    const style = getComputedStyle(this.#container);
    const paddingH = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const availCssPx = this.#container.clientWidth - paddingH;

    // Compute columns from the nominal cell size, then stretch cells to fill exactly
    this.#cols = Math.max(1, Math.floor(availCssPx / (kCellSize / pr)));
    this.#cellSize = Math.max(1, Math.round(availCssPx * pr / this.#cols));

    for (let i = 0; i < this.#cells.length; i++) {
      this.#cells[i].x = i % this.#cols;
      this.#cells[i].y = Math.floor(i / this.#cols);
    }

    this.#resizeCanvas();
  }

  #resizeCanvas(): void {
    const rows = Math.ceil(this.#cells.length / this.#cols) || 1;
    const pr = this.#renderer.getPixelRatio();
    const w = this.#cols * this.#cellSize;
    const h = rows * this.#cellSize;
    this.#renderer.setSize(w / pr, h / pr, false);
    this.canvas.style.width = `${w / pr}px`;
    this.canvas.style.height = `${h / pr}px`;
  }

  #startLoop(): void {
    const loop = () => {
      this.#raf = requestAnimationFrame(loop);
      this.#render();
    };
    this.#raf = requestAnimationFrame(loop);
  }

  #render(): void {
    this.#rot += 0.005;

    this.#renderer.clear();

    const pr = this.#renderer.getPixelRatio();
    const totalRows = Math.ceil(this.#cells.length / this.#cols) || 1;
    const cellCssPx = this.#cellSize / pr;

    // Only render cells within the container's visible scroll window.
    const scrollTop = this.#container.scrollTop;
    const containerH = this.#container.clientHeight;

    for (const cell of this.#cells) {
      const cellTop = cell.y * cellCssPx;
      const cellBottom = cellTop + cellCssPx;
      if (cellBottom <= scrollTop || cellTop >= scrollTop + containerH) {
        continue;
      }

      // Make only this cell's mesh visible so no other mesh renders into
      // its scissor region. Reset to hidden immediately after the draw call.
      cell.mesh.visible = true;
      cell.mesh.position.set(0, 0, 0);
      cell.mesh.rotation.set(0.4, this.#rot, 0);

      const x = cell.x * cellCssPx;
      // flip Y for WebGL
      const y = (totalRows - 1 - cell.y) * cellCssPx;

      this.#renderer.setViewport(x, y, cellCssPx, cellCssPx);
      this.#renderer.setScissor(x, y, cellCssPx, cellCssPx);
      this.#renderer.setScissorTest(true);
      this.#renderer.clearDepth();

      this.#scene.background = cell.blockId === this.#selectedId
        ? new THREE.Color(0x2a3a5a)
        : null;

      this.#renderer.render(this.#scene, this.#camera);

      cell.mesh.visible = false;
    }

    this.#renderer.setScissorTest(false);
  }
}
