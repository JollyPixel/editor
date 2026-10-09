// Import Third-party Dependencies
import { NameSet } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  MirrorAxes,
  ModelNodeJSON,
  VoxelModelCommand
} from "../../network/types.ts";
import { OrderedTree } from "../OrderedTree.ts";

export type NodeCommand = Extract<
  VoxelModelCommand,
  { action: `node-${string}`; }
>;

export class ModelNodes extends OrderedTree<ModelNodeJSON> {
  constructor() {
    super({
      kind: "node",
      canContain: () => true
    });
  }

  block(
    id: string
  ): BlockNodeJSON | undefined {
    const node = this.peek(id);

    return node?.kind === "block" ? structuredClone(node) : undefined;
  }

  * blocks(): IterableIterator<BlockNodeJSON> {
    for (const node of this.scan()) {
      if (node.kind === "block") {
        yield structuredClone(node);
      }
    }
  }

  isBlock(
    id: string
  ): boolean {
    return this.peek(id)?.kind === "block";
  }

  materialIdOf(
    id: string
  ): string | undefined {
    const node = this.peek(id);

    return node?.kind === "block" ? node.materialId : undefined;
  }

  blocksUsing(
    materialId: string
  ): string[] {
    return [...this.scan()]
      .filter((node) => node.kind === "block" && node.materialId === materialId)
      .map(({ id }) => id);
  }

  enclosingBlockOf(
    id: string | null
  ): string | null {
    let current = id;
    for (let step = 0; current !== null && step <= this.size; step++) {
      const node = this.peek(current);
      if (node === undefined) {
        return null;
      }
      if (node.kind === "block") {
        return node.id;
      }
      current = node.parentId;
    }

    return null;
  }

  transformParentOf(
    id: string
  ): string | null {
    return this.enclosingBlockOf(this.peek(id)?.parentId ?? null);
  }

  blockNamesUnder(
    parentId: string | null,
    exceptId?: string
  ): NameSet {
    const blockParent = this.enclosingBlockOf(parentId);
    const names: string[] = [];
    for (const node of this.scan()) {
      if (
        node.kind === "block" &&
        node.id !== exceptId &&
        this.transformParentOf(node.id) === blockParent
      ) {
        names.push(node.name);
      }
    }

    return new NameSet(names);
  }

  blockNameClashes(): Set<string> {
    const byParent = new Map<string | null, Map<string, string[]>>();
    for (const node of this.scan()) {
      if (node.kind === "block") {
        const parent = this.transformParentOf(node.id);
        const byName = byParent.get(parent) ?? new Map<string, string[]>();
        const key = NameSet.keyOf(node.name);
        byName.set(key, [...byName.get(key) ?? [], node.id]);
        byParent.set(parent, byName);
      }
    }

    return new Set(
      [...byParent.values()].flatMap(
        (byName) => [...byName.values()].filter((ids) => ids.length > 1).flat()
      )
    );
  }

  accepts(
    command: NodeCommand
  ): boolean {
    switch (command.action) {
      case "node-added":
        return this.canAdd(command.node, command.beforeId);
      case "node-removed":
      case "node-renamed":
        return this.has(command.id);
      case "node-moved":
        return this.canMove(command.id, command.parentId, command.beforeId) &&
          command.transforms.every(({ id }) => this.isBlock(id));
      case "node-transformed":
      case "node-uv-changed":
      case "node-material-changed":
        return this.isBlock(command.id);
    }
  }

  apply(
    command: NodeCommand
  ): void {
    switch (command.action) {
      case "node-added":
        this.add(command.node, command.beforeId);
        break;

      case "node-removed":
        this.remove(command.id);
        break;

      case "node-renamed":
        this.update(command.id, (node) => {
          return {
            ...node,
            name: command.name
          };
        });
        break;

      case "node-moved":
        this.move(command.id, command.parentId, command.beforeId);
        for (const { id, transform } of command.transforms) {
          this.#transform(id, transform);
        }
        break;

      case "node-transformed":
        this.#transform(command.id, command.transform);
        if (command.flipAxes) {
          this.#flip(command.id, command.flipAxes);
        }
        break;

      case "node-uv-changed":
        this.#patchBlock(command.id, { uv: structuredClone(command.uv) });
        break;

      case "node-material-changed":
        this.assignMaterial(command.id, command.materialId);
        break;
    }
  }

  assignMaterial(
    id: string,
    materialId: string | null
  ): void {
    this.update(id, (node) => {
      if (node.kind !== "block") {
        return node;
      }

      const { materialId: _previous, ...rest } = node;

      return materialId === null ?
        rest :
        {
          ...rest,
          materialId
        };
    });
  }

  #patchBlock(
    id: string,
    patch: Partial<Pick<BlockNodeJSON, "transform" | "uv">>
  ): void {
    this.update(id, (node) => (node.kind === "block" ?
      {
        ...node,
        ...patch
      } :
      node));
  }

  #flip(
    id: string,
    flipAxes: MirrorAxes
  ): void {
    this.update(id, (node) => {
      if (node.kind !== "block") {
        return node;
      }

      const { flipAxes: _previous, ...rest } = node;

      return flipAxes.x || flipAxes.y || flipAxes.z ?
        {
          ...rest,
          flipAxes: { ...flipAxes }
        } :
        rest;
    });
  }

  #transform(
    id: string,
    transform: BlockTransformJSON
  ): void {
    this.#patchBlock(id, { transform: structuredClone(transform) });
  }
}
