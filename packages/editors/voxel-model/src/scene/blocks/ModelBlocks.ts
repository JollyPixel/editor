// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  MirrorAxes,
  ModelChange,
  ModelDocument,
  NodeTransformJSON
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import type { BlockPoses } from "../../model/index.ts";
import type { BlockSelectionStore } from "../../state/index.ts";
import { BlockNode } from "./BlockNode.ts";
import { ModelBlock } from "./ModelBlock.ts";
import { plainVector3 } from "./plainVector3.ts";
import {
  mirrorRotation,
  mirrorSignFromAxes,
  mirrorVector
} from "./mirrorTransform.ts";

export type ModelBlocksEvents = {
  blockAdded: (block: ModelBlock) => void;
  blockRemoved: (uuid: string) => void;
};

export interface ModelBlocksOptions {
  document: ModelDocument;
  scene: THREE.Object3D;
  selection: BlockSelectionStore;
}

export class ModelBlocks extends Emitter<ModelBlocksEvents> implements BlockPoses {
  #document: ModelDocument;
  #scene: THREE.Object3D;
  #blocks = new Map<string, ModelBlock>();
  #byMesh = new Map<THREE.Object3D, ModelBlock>();
  #selection: BlockSelectionStore;
  #texture: THREE.Texture | null = null;

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    switch (command.action) {
      case "node-added":
        if (command.node.kind === "block") {
          this.#attach(this.#create(command.node));
        }
        break;

      case "node-removed":
        for (const node of change.removed) {
          this.#discard(node.id);
        }
        break;

      case "node-renamed": {
        const block = this.#blocks.get(command.id);
        if (block) {
          block.name = command.name;
        }
        break;
      }

      case "node-moved":
        for (const node of this.#document.tree.subtreeOf(command.id)) {
          const block = this.#blocks.get(node.id);
          if (block) {
            this.#attach(block);
          }
        }
        for (const { id, transform } of command.transforms) {
          this.applyTransform(id, transform);
        }
        break;

      case "node-transformed":
        this.applyTransform(command.id, command.transform);
        break;
    }
  };

  #onReset = (): void => {
    for (const uuid of [...this.#blocks.keys()]) {
      this.#discard(uuid);
    }

    const blocks = [...this.#document.tree.blocks()].map(
      (node) => this.#create(node)
    );
    for (const block of blocks) {
      this.#attach(block);
    }
  };

  constructor(
    options: ModelBlocksOptions
  ) {
    super();
    this.#document = options.document;
    this.#scene = options.scene;
    this.#selection = options.selection;

    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#onReset);
    this.#onReset();
  }

  get size(): number {
    return this.#blocks.size;
  }

  get texture(): THREE.Texture | null {
    return this.#texture;
  }

  set texture(
    texture: THREE.Texture | null
  ) {
    this.#texture = texture;
    for (const block of this.#blocks.values()) {
      block.texture = texture;
    }
  }

  values(): IterableIterator<ModelBlock> {
    return this.#blocks.values();
  }

  get(
    uuid: string
  ): ModelBlock | undefined {
    return this.#blocks.get(uuid);
  }

  fromMesh(
    object: THREE.Object3D
  ): ModelBlock | undefined {
    return this.#byMesh.get(object);
  }

  applyTransform(
    uuid: string,
    transform: BlockTransformJSON
  ): void {
    const block = this.#blocks.get(uuid);
    if (block) {
      block.transform = transform;
    }
  }

  commitTransform(
    uuid: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (block) {
      this.#document.transform(uuid, block.transform);
    }
  }

  under(
    uuid: string,
    parentUuid: string | null
  ): BlockTransformJSON {
    const block = this.#blocks.get(uuid);
    if (!block) {
      throw new Error(`No block ${uuid} to place under ${String(parentUuid)}.`);
    }

    this.#scene.updateMatrixWorld(true);
    const parent = this.#parentObject(parentUuid);
    const parentRotation = parent.getWorldQuaternion(new THREE.Quaternion());
    const rotation = new THREE.Euler().setFromQuaternion(
      parentRotation.invert().multiply(
        block.node.getWorldQuaternion(new THREE.Quaternion())
      ),
      block.node.rotation.order
    );

    return {
      ...block.transform,
      position: plainVector3(parent.worldToLocal(block.worldPosition)),
      scale: plainVector3(block.effectiveScale.divide(BlockNode.anchorScaleOf(parent))),
      rotation: plainVector3(rotation)
    };
  }

  mirror(
    uuids: Iterable<string>,
    axes: MirrorAxes
  ): NodeTransformJSON[] {
    const sign = mirrorSignFromAxes(axes);
    this.#scene.updateMatrixWorld(true);
    const poses = [...uuids]
      .map((uuid) => this.#blocks.get(uuid))
      .filter((block) => block !== undefined)
      .map((block) => {
        return {
          block,
          position: block.worldPosition,
          rotation: block.worldRotation,
          pivotOffset: block.pivotOffset
        };
      });

    return poses.map(({ block, position, rotation, pivotOffset }) => {
      block.worldPosition = mirrorVector(position, sign);
      this.#scene.updateMatrixWorld(true);
      block.worldRotation = mirrorRotation(rotation, sign);
      block.moveBoxAroundPivot(mirrorVector(pivotOffset, sign));
      this.#scene.updateMatrixWorld(true);

      return {
        id: block.uuid,
        transform: block.transform
      };
    });
  }

  dispose(): void {
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#onReset);
    for (const uuid of [...this.#blocks.keys()]) {
      this.#discard(uuid);
    }
  }

  #create(
    node: BlockNodeJSON
  ): ModelBlock {
    const block = new ModelBlock({
      uuid: node.id,
      name: node.name,
      texture: this.#texture
    });
    block.transform = node.transform;
    this.#blocks.set(block.uuid, block);
    this.#byMesh.set(block.mesh, block);
    this.emit("blockAdded", block);

    return block;
  }

  #attach(
    block: ModelBlock
  ): void {
    const parent = this.#parentObject(
      this.#document.tree.transformParentOf(block.uuid)
    );
    if (block.node.parent !== parent) {
      parent.add(block.node);
    }
  }

  #discard(
    uuid: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (!block) {
      return;
    }

    this.#selection.forget(uuid);
    this.#blocks.delete(uuid);
    this.#byMesh.delete(block.mesh);
    block.dispose();
    this.emit("blockRemoved", uuid);
  }

  #parentObject(
    parentUuid: string | null
  ): THREE.Object3D {
    return parentUuid === null ?
      this.#scene :
      this.#blocks.get(parentUuid)?.node ?? this.#scene;
  }
}
