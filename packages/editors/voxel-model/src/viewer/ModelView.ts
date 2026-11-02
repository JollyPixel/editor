// Import Third-party Dependencies
import * as THREE from "three";
import type { Vec2 } from "@jolly-pixel/pixel-draw.renderer";
import type {
  MaterialSurfaceJSON,
  ModelChange,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { ViewBlock } from "./ViewBlock.ts";

export interface ModelViewTexture {
  readonly map: THREE.Texture;
  size(): Vec2;
}

export interface ModelViewOptions {
  document: ModelDocument;
  texture: ModelViewTexture;
  requestFrame?: () => void;
}

export class ModelView {
  readonly root = new THREE.Group();

  readonly #document: ModelDocument;
  readonly #texture: ModelViewTexture;
  readonly #requestFrame: () => void;
  readonly #blocks = new Map<string, ViewBlock>();
  readonly #subscriptions: Array<() => void>;
  #castShadow = false;
  #receiveShadow = false;

  readonly #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    const { tree } = this.#document;
    switch (command.action) {
      case "node-added":
        if (command.node.kind === "block") {
          this.#add(command.node.id);
          this.#attach(command.node.id);
          this.#refresh(command.node.id);
        }
        break;

      case "node-removed":
        for (const node of change.image.before.nodes) {
          this.#discard(node.id);
        }
        break;

      case "node-moved":
        for (const node of tree.subtreeFrom(command.id)) {
          this.#attach(node.id);
          this.#refresh(node.id);
        }
        break;

      case "node-transformed":
      case "node-uv-changed":
      case "node-shape-changed":
      case "node-material-changed":
        this.#refresh(command.id);
        break;

      case "material-changed":
        for (const id of tree.blocksUsing(command.id)) {
          this.#refresh(id);
        }
        break;

      case "material-removed":
        this.#refreshAll();
        break;

      case "node-renamed":
      case "material-added":
      case "material-folder-added":
      case "material-moved":
      case "material-renamed":
      case "animation-binding-changed":
      case "animation-binding-cleared":
      case "animation-set-linked":
      case "animation-set-owned":
      case "animation-set-unlinked":
        return;

      default:
        return command satisfies never;
    }

    this.#requestFrame();
  };

  readonly #onReset = (): void => {
    for (const id of [...this.#blocks.keys()]) {
      this.#discard(id);
    }

    const blocks = [...this.#document.tree.blocks()];
    for (const { id } of blocks) {
      this.#add(id);
    }
    for (const { id } of blocks) {
      this.#attach(id);
    }
    this.#refreshAll();
    this.#requestFrame();
  };

  constructor(
    options: ModelViewOptions
  ) {
    this.#document = options.document;
    this.#texture = options.texture;
    this.#requestFrame = options.requestFrame ?? (() => undefined);
    this.#subscriptions = [
      this.#document.subscribe("change", this.#onChange),
      this.#document.subscribe("reset", this.#onReset)
    ];
    this.#onReset();
  }

  get castShadow(): boolean {
    return this.#castShadow;
  }

  set castShadow(
    value: boolean
  ) {
    this.#castShadow = value;
    for (const { mesh } of this.#blocks.values()) {
      mesh.castShadow = value;
    }
    this.#requestFrame();
  }

  get receiveShadow(): boolean {
    return this.#receiveShadow;
  }

  set receiveShadow(
    value: boolean
  ) {
    this.#receiveShadow = value;
    for (const { mesh } of this.#blocks.values()) {
      mesh.receiveShadow = value;
    }
    this.#requestFrame();
  }

  remapTexture(): void {
    this.#refreshAll();
    this.#requestFrame();
  }

  requestFrame(): void {
    this.#requestFrame();
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions) {
      unsubscribe();
    }
    for (const id of [...this.#blocks.keys()]) {
      this.#discard(id);
    }
    this.root.removeFromParent();
  }

  #add(
    id: string
  ): void {
    const node = this.#document.tree.block(id);
    if (node === undefined || this.#blocks.has(id)) {
      return;
    }

    const block = new ViewBlock(node, this.#texture);
    block.mesh.castShadow = this.#castShadow;
    block.mesh.receiveShadow = this.#receiveShadow;
    this.#blocks.set(id, block);
  }

  #attach(
    id: string
  ): void {
    const block = this.#blocks.get(id);
    if (block === undefined) {
      return;
    }

    const parentId = this.#document.tree.findTransformParent(id);
    const parent = parentId === null ?
      this.root :
      this.#blocks.get(parentId)?.node ?? this.root;
    if (block.node.parent !== parent) {
      parent.add(block.node);
    }
  }

  #refresh(
    id: string
  ): void {
    const block = this.#blocks.get(id);
    const node = this.#document.tree.block(id);
    if (block !== undefined && node !== undefined) {
      block.update(node, this.#surface(id));
    }
  }

  #refreshAll(): void {
    for (const id of this.#blocks.keys()) {
      this.#refresh(id);
    }
  }

  #surface(
    id: string
  ): MaterialSurfaceJSON | null {
    const { tree } = this.#document;
    const materialId = tree.blockMaterialId(id);

    return materialId === undefined ?
      null :
      tree.materials.material(materialId)?.surface ?? null;
  }

  #discard(
    id: string
  ): void {
    this.#blocks.get(id)?.dispose();
    this.#blocks.delete(id);
  }
}
