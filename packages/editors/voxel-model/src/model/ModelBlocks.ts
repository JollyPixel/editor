// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import type {
  GroupTransformJSON,
  MirrorAxes,
  ModelCommand,
  ModelNodeJSON
} from "@jolly-pixel/asset.voxel-model/network/client.ts";

// Import Internal Dependencies
import {
  ModelBlock,
  type ModelBlockOptions
} from "./ModelBlock.ts";
import {
  toEuler,
  toVector3
} from "./transformCodec.ts";
import {
  mirrorRotation,
  mirrorSignFromAxes,
  mirrorVector
} from "./mirrorTransform.ts";

export type ModelBlocksEvents = {
  command: (command: ModelCommand) => void;
  select: (block: ModelBlock | null) => void;
};

export class ModelBlocks extends Emitter<ModelBlocksEvents> {
  #scene: THREE.Object3D;
  #blocks = new Map<string, ModelBlock>();
  #byObject = new Map<THREE.Object3D, ModelBlock>();
  #flipAxes = new Map<string, MirrorAxes>();
  #selected: ModelBlock | null = null;
  #texture: THREE.Texture | null = null;
  #muted = false;

  constructor(
    scene: THREE.Object3D
  ) {
    super();
    this.#scene = scene;
  }

  get size(): number {
    return this.#blocks.size;
  }

  get selected(): ModelBlock | null {
    return this.#selected;
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
    const block = this.#byObject.get(object);

    return block?.mesh === object ? block : undefined;
  }

  parentOf(
    uuid: string
  ): string | null {
    const parent = this.#blocks.get(uuid)?.root.parent;
    if (!parent) {
      return null;
    }

    const block = this.#byObject.get(parent);

    return block?.pivot === parent ? block.uuid : null;
  }

  flipAxesOf(
    uuid: string
  ): MirrorAxes | undefined {
    return this.#flipAxes.get(uuid);
  }

  select(
    block: ModelBlock | null
  ): void {
    if (this.#selected !== block) {
      if (this.#selected !== null) {
        this.#selected.selected = false;
      }
      this.#selected = block;
      if (block !== null) {
        block.selected = true;
      }
    }

    this.emit("select", block);
  }

  add(
    options: ModelBlockOptions = {}
  ): ModelBlock {
    const block = new ModelBlock({
      texture: this.#texture,
      ...options
    });
    this.#blocks.set(block.uuid, block);
    this.#byObject.set(block.mesh, block);
    this.#byObject.set(block.pivot, block);
    this.#scene.add(block.root);

    this.#emit({
      action: "group-added",
      uuid: block.uuid,
      name: block.name,
      transform: block.transform
    });

    return block;
  }

  remove(
    uuid: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (!block) {
      return;
    }

    if (this.#selected === block) {
      this.select(null);
    }

    this.#blocks.delete(uuid);
    this.#byObject.delete(block.mesh);
    this.#byObject.delete(block.pivot);
    this.#flipAxes.delete(uuid);
    block.dispose();

    this.#emit({ action: "group-removed", uuid });
  }

  rename(
    uuid: string,
    name: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (!block) {
      return;
    }

    block.name = name;
    this.#emit({ action: "group-renamed", uuid, name });
  }

  commitTransform(
    uuid: string
  ): void {
    const block = this.#blocks.get(uuid);
    if (!block) {
      return;
    }

    this.#emit({
      action: "group-transformed",
      uuid,
      transform: block.transform
    });
  }

  applyTransform(
    uuid: string,
    transform: GroupTransformJSON
  ): void {
    const block = this.#blocks.get(uuid);
    if (block) {
      block.transform = transform;
    }
  }

  reparent(
    childUuid: string,
    parentUuid: string | null
  ): void {
    const child = this.#blocks.get(childUuid);
    const parent = this.#parentObject(parentUuid);
    if (!child || !parent) {
      return;
    }

    parent.attach(child.root);
    this.#emit({
      action: "group-reparented",
      uuid: childUuid,
      parentUuid,
      transform: child.transform
    });
  }

  reparentAtParentPosition(
    childUuid: string,
    parentUuid: string
  ): void {
    const child = this.#blocks.get(childUuid);
    const parent = this.#blocks.get(parentUuid);
    if (!child || !parent) {
      return;
    }

    child.worldPosition = parent.worldPosition;
    this.reparent(childUuid, parentUuid);
  }

  reparentLocal(
    childUuid: string,
    parentUuid: string | null
  ): void {
    const child = this.#blocks.get(childUuid);
    const parent = this.#parentObject(parentUuid);
    if (!child || !parent) {
      return;
    }

    parent.add(child.root);
    this.#emit({
      action: "group-reparented-local",
      uuid: childUuid,
      parentUuid
    });
  }

  duplicate(
    sourceUuid: string,
    name?: string
  ): ModelBlock | null {
    const source = this.#blocks.get(sourceUuid);
    if (!source) {
      return null;
    }

    return this.add({
      position: source.position,
      pivotOffset: source.pivotOffset,
      size: source.size,
      scale: source.scale,
      rotation: source.rotation,
      name: name ?? source.name
    });
  }

  mirror(
    uuids: Iterable<string>,
    axes: MirrorAxes
  ): void {
    const sign = mirrorSignFromAxes(axes);
    const snapshots = [...uuids]
      .map((uuid) => this.#blocks.get(uuid))
      .filter((block) => block !== undefined)
      .map((block) => {
        return {
          block,
          position: block.worldPosition,
          rotation: block.worldRotation,
          pivotOffset: block.worldPivotOffset
        };
      });

    for (const { block, position, rotation, pivotOffset } of snapshots) {
      block.worldPosition = mirrorVector(position, sign);
      this.#scene.updateMatrixWorld(true);
      block.worldRotation = mirrorRotation(rotation, sign);
      block.worldPivotOffset = mirrorVector(pivotOffset, sign);
      this.#scene.updateMatrixWorld(true);

      this.#flipAxes.set(block.uuid, axes);
      this.#emit({
        action: "group-transformed",
        uuid: block.uuid,
        transform: block.transform,
        flipAxes: axes
      });
    }
  }

  apply(
    command: ModelCommand
  ): void {
    this.#silently(() => {
      switch (command.action) {
        case "group-added":
          if (!this.#blocks.has(command.uuid)) {
            this.add({
              uuid: command.uuid,
              name: command.name,
              position: toVector3(command.transform.position),
              pivotOffset: toVector3(command.transform.pivotOffset),
              size: toVector3(command.transform.size),
              scale: toVector3(command.transform.scale),
              rotation: toEuler(command.transform.rotation)
            });
          }
          break;

        case "group-removed":
          this.remove(command.uuid);
          break;

        case "group-renamed":
          this.rename(command.uuid, command.name);
          break;

        case "group-reparented":
          this.reparent(command.uuid, command.parentUuid);
          this.applyTransform(command.uuid, command.transform);
          break;

        case "group-reparented-local":
          this.reparentLocal(command.uuid, command.parentUuid);
          break;

        case "group-transformed":
          this.applyTransform(command.uuid, command.transform);
          if (command.flipAxes) {
            this.#flipAxes.set(command.uuid, command.flipAxes);
          }
          break;

        default: {
          const unhandled: never = command;
          throw new Error(
            `ModelBlocks.apply: unhandled action '${(unhandled as ModelCommand).action}'.`
          );
        }
      }
    });
  }

  load(
    nodes: readonly ModelNodeJSON[]
  ): void {
    this.#silently(() => {
      for (const uuid of [...this.#blocks.keys()]) {
        this.remove(uuid);
      }

      for (const node of nodes) {
        this.add({
          uuid: node.uuid,
          name: node.name,
          position: toVector3(node.position),
          pivotOffset: toVector3(node.pivotOffset),
          size: toVector3(node.size),
          scale: toVector3(node.scale),
          rotation: toEuler(node.rotation)
        });
      }

      for (const node of nodes) {
        if (node.parentUuid !== null) {
          this.reparentLocal(node.uuid, node.parentUuid);
        }
        if (node.flipAxes) {
          this.#flipAxes.set(node.uuid, node.flipAxes);
        }
      }
    });
  }

  #parentObject(
    parentUuid: string | null
  ): THREE.Object3D | undefined {
    return parentUuid === null ?
      this.#scene :
      this.#blocks.get(parentUuid)?.pivot;
  }

  #emit(
    command: ModelCommand
  ): void {
    if (!this.#muted) {
      this.emit("command", command);
    }
  }

  #silently(
    fn: () => void
  ): void {
    const previous = this.#muted;
    this.#muted = true;
    try {
      fn();
    }
    finally {
      this.#muted = previous;
    }
  }
}
