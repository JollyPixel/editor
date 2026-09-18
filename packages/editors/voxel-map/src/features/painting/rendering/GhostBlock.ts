// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlockSurface,
  type BlockRegistry,
  type VoxelTransform,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  buildBlockGeometry,
  textureOf,
  type BlockPreviewSources
} from "../../blocks/blockPreviewMesh.ts";
import type { GhostTarget } from "../model/ghostTarget.ts";

// CONSTANTS
const kDefaultOpacity = 0.55;
const kOverlayScale = 1.02;

export interface GhostBlockOptions extends BlockPreviewSources {
  blockRegistry: BlockRegistry;
  /**
   * @default 0.55
   */
  opacity?: number;
}

export class GhostBlock extends THREE.Group {
  #sources: BlockPreviewSources;
  #blockRegistry: BlockRegistry;
  #mesh: THREE.Mesh;
  #empty = new THREE.BufferGeometry();
  #material: THREE.MeshLambertMaterial;
  #hidden: THREE.MeshBasicMaterial;
  #block: ResolvedBlockDefinition | null = null;
  #tilesetVersion = -1;
  #geometries = new Map<number, THREE.BufferGeometry | null>();

  constructor(
    options: GhostBlockOptions
  ) {
    super();

    const {
      blockRegistry,
      opacity = kDefaultOpacity,
      ...sources
    } = options;

    this.name = "ghost-block";
    this.#sources = sources;
    this.#blockRegistry = blockRegistry;
    this.#material = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity,
      depthWrite: false
    });
    this.#hidden = new THREE.MeshBasicMaterial({
      visible: false
    });
    this.#mesh = new THREE.Mesh(
      this.#empty,
      [this.#material, this.#hidden]
    );
    this.#mesh.renderOrder = 1;
    this.#mesh.frustumCulled = false;
    this.add(this.#mesh);
    this.visible = false;
  }

  draw(
    target: GhostTarget
  ): boolean {
    const block = this.#blockRegistry.get(target.blockId);
    if (block === undefined) {
      this.hide();

      return false;
    }

    this.#adopt(block);
    const geometry = this.#geometryOf(block, target.transform);
    if (geometry === null) {
      this.hide();

      return false;
    }

    const { x, y, z } = target.position;
    const scale = target.overlay ? kOverlayScale : 1;
    this.#mesh.geometry = geometry;
    this.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scale.setScalar(scale);
    this.visible = true;

    return true;
  }

  hide(): void {
    this.visible = false;
  }

  override dispose(): void {
    this.#mesh.geometry = this.#empty;
    this.#clear();
    this.#empty.dispose();
    this.#material.dispose();
    this.#hidden.dispose();
    super.dispose();
  }

  #adopt(
    block: ResolvedBlockDefinition
  ): void {
    const { version } = this.#sources.tilesetManager;
    if (block === this.#block && version === this.#tilesetVersion) {
      return;
    }

    this.#mesh.geometry = this.#empty;
    this.#clear();
    this.#block = block;
    this.#tilesetVersion = version;

    const surface = new BlockSurface(block);
    const map = textureOf(block, this.#sources);
    this.#material.map = map;
    this.#material.alphaTest = surface.alphaCutoff;
    this.#material.side = surface.side === "double" ?
      THREE.DoubleSide :
      THREE.FrontSide;
    this.#material.needsUpdate = true;
  }

  #geometryOf(
    block: ResolvedBlockDefinition,
    transform: VoxelTransform
  ): THREE.BufferGeometry | null {
    const cached = this.#geometries.get(transform.packed);
    if (cached !== undefined) {
      return cached;
    }

    const geometry = buildBlockGeometry(
      block,
      this.#sources,
      transform
    );
    geometry?.translate(-0.5, -0.5, -0.5);
    this.#geometries.set(transform.packed, geometry);

    return geometry;
  }

  #clear(): void {
    for (const geometry of this.#geometries.values()) {
      geometry?.dispose();
    }
    this.#geometries.clear();
  }
}
