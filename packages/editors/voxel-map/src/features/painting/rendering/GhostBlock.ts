// Import Third-party Dependencies
import * as THREE from "three";
import type {
  BlockPiece,
  BlockPieces,
  BlockRegistry,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { BlockRenderSources } from "../../blocks/rendering/BlockRenderSources.ts";
import type { GhostTarget } from "../model/ghostTarget.ts";

// CONSTANTS
const kOpacity = 0.55;
const kOverlayScale = 1.02;

export interface GhostBlockOptions {
  sources: BlockRenderSources;
  blockRegistry: BlockRegistry;
}

export class GhostBlock extends THREE.Group {
  #blockRegistry: BlockRegistry;
  #pieces: BlockPieces;
  #mesh: THREE.Mesh;
  #empty = new THREE.BufferGeometry();
  #material: THREE.MeshLambertMaterial;
  #hidden: THREE.MeshBasicMaterial;
  #block: ResolvedBlockDefinition | null = null;
  #piece: BlockPiece | null = null;

  constructor(
    options: GhostBlockOptions
  ) {
    super();

    this.name = "ghost-block";
    this.#blockRegistry = options.blockRegistry;
    this.#pieces = options.sources.createPieces();
    this.#material = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: kOpacity,
      depthWrite: false
    });
    this.#hidden = new THREE.MeshBasicMaterial({
      visible: false
    });
    this.#mesh = new THREE.Mesh(
      this.#empty,
      [this.#material, this.#hidden]
    );
    this.#mesh.position.set(-0.5, -0.5, -0.5);
    this.#mesh.renderOrder = 1;
    this.#mesh.frustumCulled = false;
    this.add(this.#mesh);
    this.visible = false;
  }

  draw(
    target: GhostTarget
  ): boolean {
    const block = this.#blockRegistry.get(target.blockId);
    if (block !== this.#block) {
      this.#block = block ?? null;
      this.#forget();
    }

    const piece = block === undefined ?
      null :
      this.#pieces.pieceOf(block, target.transform);
    if (piece === null) {
      this.hide();

      return false;
    }

    this.#adopt(piece);
    const { x, y, z } = target.position;
    this.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scale.setScalar(target.overlay ? kOverlayScale : 1);
    this.visible = true;

    return true;
  }

  hide(): void {
    this.visible = false;
  }

  override dispose(): void {
    this.#forget();
    this.#empty.dispose();
    this.#material.dispose();
    this.#hidden.dispose();
    super.dispose();
  }

  #adopt(
    piece: BlockPiece
  ): void {
    if (piece === this.#piece) {
      return;
    }

    this.#piece = piece;
    this.#mesh.geometry = piece.geometry;
    this.#material.map = piece.texture;
    this.#material.alphaTest = piece.surface.alphaCutoff;
    this.#material.side = piece.surface.side === "double" ?
      THREE.DoubleSide :
      THREE.FrontSide;
    this.#material.needsUpdate = true;
  }

  #forget(): void {
    this.#mesh.geometry = this.#empty;
    this.#piece = null;
    this.#pieces.clear();
  }
}
