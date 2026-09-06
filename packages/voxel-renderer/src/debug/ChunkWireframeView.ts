// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  ChunkDebugView,
  DebugChunkEntry
} from "./types.ts";

// CONSTANTS
const kDefaultColor = 0x66FF99;
const kDefaultOpacity = 0.5;
const kModeCycle: Record<VoxelDebugMode, VoxelDebugMode> = {
  off: "overlay",
  overlay: "wireframe",
  wireframe: "off"
};

/**
 * Selects counters only, a wireframe overlay, or wireframe-only rendering.
 */
export type VoxelDebugMode =
  | "off"
  | "overlay"
  | "wireframe";

export interface ChunkWireframeViewOptions {
  parent: THREE.Object3D;
  chunks: Iterable<DebugChunkEntry>;
  /**
   * @default "off"
   */
  mode?: VoxelDebugMode;
  /**
   * @default 0x66FF99
   */
  color?: THREE.ColorRepresentation;
  /**
   * `1` disables blending.
   * @default 0.5
   */
  opacity?: number;
}

/**
 * Draws a wireframe copy of every chunk mesh, and owns the `visible` flag of
 * the textured meshes: `"wireframe"` hides them, and a culled chunk is hidden
 * in every mode.
 */
export class ChunkWireframeView implements ChunkDebugView {
  #parent: THREE.Object3D;
  #chunks: Iterable<DebugChunkEntry>;
  #group = new THREE.Group();
  #overlays = new Map<string, THREE.Mesh[]>();
  #material: THREE.MeshBasicMaterial | null = null;

  #mode: VoxelDebugMode;
  #color: THREE.ColorRepresentation;
  #opacity: number;

  constructor(
    options: ChunkWireframeViewOptions
  ) {
    const {
      parent,
      chunks,
      mode = "off",
      color = kDefaultColor,
      opacity = kDefaultOpacity
    } = options;

    this.#parent = parent;
    this.#chunks = chunks;
    this.#mode = mode;
    this.#color = color;
    this.#opacity = opacity;

    this.#group.name = "VoxelDebugger";
    if (this.enabled) {
      parent.add(this.#group);
    }
  }

  get mode(): VoxelDebugMode {
    return this.#mode;
  }

  set mode(value: VoxelDebugMode) {
    if (value === this.#mode) {
      return;
    }

    this.#mode = value;
    for (const entry of this.#chunks) {
      this.refresh(entry);
    }

    if (this.enabled) {
      this.#parent.add(this.#group);
    }
    else {
      this.#group.removeFromParent();
    }
  }

  get enabled(): boolean {
    return this.#mode !== "off";
  }

  set enabled(value: boolean) {
    this.mode = value ? "overlay" : "off";
  }

  nextMode(): VoxelDebugMode {
    this.mode = kModeCycle[this.#mode];

    return this.#mode;
  }

  refresh(
    entry: DebugChunkEntry
  ): void {
    const visible = !entry.culled && this.#mode !== "wireframe";
    for (const mesh of entry.meshes) {
      mesh.visible = visible;
    }

    if (this.#mode === "off" || entry.culled) {
      this.release(entry.key);

      return;
    }
    if (this.#overlays.has(entry.key)) {
      return;
    }

    const material = this.#resolveMaterial();
    const overlays: THREE.Mesh[] = [];
    for (const mesh of entry.meshes) {
      const overlay = new THREE.Mesh(mesh.geometry, material);
      overlay.name = `${mesh.name}:wireframe`;
      overlays.push(overlay);
      this.#group.add(overlay);
    }
    this.#overlays.set(entry.key, overlays);
  }

  release(
    key: string
  ): void {
    const overlays = this.#overlays.get(key);
    if (!overlays) {
      return;
    }

    for (const overlay of overlays) {
      this.#group.remove(overlay);
    }
    this.#overlays.delete(key);
  }

  clear(): void {
    this.#group.clear();
    this.#overlays.clear();
  }

  dispose(): void {
    this.clear();
    this.#group.removeFromParent();
    this.#material?.dispose();
    this.#material = null;
  }

  #resolveMaterial(): THREE.MeshBasicMaterial {
    this.#material ??= new THREE.MeshBasicMaterial({
      color: this.#color,
      wireframe: true,
      transparent: this.#opacity < 1,
      opacity: this.#opacity,
      depthWrite: false,
      fog: false
    });

    return this.#material;
  }
}
