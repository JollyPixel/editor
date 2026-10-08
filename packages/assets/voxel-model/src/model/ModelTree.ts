// Import Internal Dependencies
import type {
  BlockNodeJSON,
  BlockTransformJSON,
  MaterialEntryJSON,
  MirrorAxes,
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";
import { InvalidModelTreeError } from "./errors/InvalidModelTreeError.ts";
import {
  ModelAnimationLinks,
  type ModelAnimationLinksReader
} from "./ModelAnimationLinks.ts";
import {
  entryImagesOf,
  entrySlotOf,
  type ModelEntryTree
} from "./modelCommands.ts";
import type { ModelImages } from "./modelImages.ts";
import {
  ModelMaterials,
  type ModelMaterialsReader
} from "./ModelMaterials.ts";
import { OrderedTree } from "./OrderedTree.ts";

export type ModelTreeReader = Pick<
  ModelTree,
  | "size"
  | "has"
  | "get"
  | "block"
  | "materialIdOf"
  | "values"
  | "blocks"
  | "childrenOf"
  | "nextSiblingOf"
  | "subtreeOf"
  | "imagesOf"
  | "enclosingBlockOf"
  | "transformParentOf"
  | "placeable"
  | "materials"
  | "animationSets"
  | "blocksUsing"
  | "materialUses"
  | "accepts"
>;

export class ModelTree {
  #nodes = createNodeTree();
  #materials = new ModelMaterials();
  #links = new ModelAnimationLinks();

  get size(): number {
    return this.#nodes.size;
  }

  get materials(): ModelMaterialsReader {
    return this.#materials;
  }

  get animationSets(): ModelAnimationLinksReader {
    return this.#links;
  }

  blocksUsing(
    materialId: string
  ): string[] {
    return [...this.#nodes.scan()]
      .filter((node) => node.kind === "block" && node.materialId === materialId)
      .map(({ id }) => id);
  }

  materialUses(): Map<string, number> {
    const uses = new Map<string, number>();
    for (const { id } of this.#materials.materials()) {
      uses.set(id, 0);
    }
    for (const node of this.#nodes.scan()) {
      if (node.kind === "block" && node.materialId !== undefined) {
        uses.set(node.materialId, (uses.get(node.materialId) ?? 0) + 1);
      }
    }

    return uses;
  }

  has(
    id: string
  ): boolean {
    return this.#nodes.has(id);
  }

  get(
    id: string
  ): ModelNodeJSON | undefined {
    return this.#nodes.get(id);
  }

  block(
    id: string
  ): BlockNodeJSON | undefined {
    const node = this.#nodes.peek(id);

    return node?.kind === "block" ? structuredClone(node) : undefined;
  }

  materialIdOf(
    id: string
  ): string | undefined {
    const node = this.#nodes.peek(id);

    return node?.kind === "block" ? node.materialId : undefined;
  }

  values(): IterableIterator<ModelNodeJSON> {
    return this.#nodes.values();
  }

  * blocks(): IterableIterator<BlockNodeJSON> {
    for (const node of this.#nodes.scan()) {
      if (node.kind === "block") {
        yield structuredClone(node);
      }
    }
  }

  childrenOf(
    parentId: string | null
  ): ModelNodeJSON[] {
    return this.#nodes.childrenOf(parentId);
  }

  nextSiblingOf(
    id: string
  ): string | undefined {
    return this.#nodes.nextSiblingOf(id);
  }

  subtreeOf(
    id: string
  ): ModelNodeJSON[] {
    return this.#nodes.subtreeOf(id);
  }

  imagesOf(
    command: VoxelModelCommand
  ): ModelImages {
    return entryImagesOf(this, command);
  }

  enclosingBlockOf(
    id: string | null
  ): string | null {
    let current = id;
    for (let step = 0; current !== null && step <= this.#nodes.size; step++) {
      const node = this.#nodes.peek(current);
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
    return this.enclosingBlockOf(
      this.#nodes.peek(id)?.parentId ?? null
    );
  }

  placeable(
    command: VoxelModelCommand
  ): VoxelModelCommand {
    const slot = entrySlotOf(command);
    if (
      slot?.beforeId === undefined ||
      this.#entries(slot.which).isSiblingSlot(slot.beforeId, slot.parentId, slot.id)
    ) {
      return command;
    }

    return withoutBefore(command);
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    switch (command.action) {
      case "node-added":
        return this.#nodes.canAdd(command.node, command.beforeId) &&
          hasKnownMaterial(command.node, this.#materials);
      case "node-removed":
      case "node-renamed":
        return this.#nodes.has(command.id);
      case "node-moved":
        return this.#nodes.canMove(command.id, command.parentId, command.beforeId) &&
          command.transforms.every(({ id }) => this.#isBlock(id));
      case "node-transformed":
      case "node-uv-changed":
        return this.#isBlock(command.id);
      case "node-material-changed":
        return this.#isBlock(command.id) && (
          command.materialId === null ||
          this.#materials.material(command.materialId) !== undefined
        );
      case "material-added":
      case "material-folder-added":
      case "material-moved":
      case "material-removed":
      case "material-renamed":
      case "material-changed":
        return this.#materials.accepts(command);
      case "animation-set-linked":
      case "animation-set-unlinked":
      case "animation-set-owned":
      case "animation-binding-changed":
      case "animation-binding-cleared":
        return this.#links.accepts(command);
    }
  }

  apply(
    command: VoxelModelCommand
  ): void {
    switch (command.action) {
      case "node-added":
        this.#nodes.add(command.node, command.beforeId);
        break;

      case "node-removed":
        this.#nodes.remove(command.id);
        break;

      case "node-renamed":
        this.#nodes.update(command.id, (node) => {
          return {
            ...node,
            name: command.name
          };
        });
        break;

      case "node-moved":
        this.#nodes.move(command.id, command.parentId, command.beforeId);
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
        this.#assignMaterial(command.id, command.materialId);
        break;

      case "material-added":
      case "material-folder-added":
      case "material-moved":
      case "material-removed":
      case "material-renamed":
      case "material-changed":
        this.#materials.apply(command);
        this.#dropMissingMaterials();
        break;

      case "animation-set-linked":
      case "animation-set-unlinked":
      case "animation-set-owned":
      case "animation-binding-changed":
      case "animation-binding-cleared":
        this.#links.apply(command);
        break;
    }
  }

  load(
    snapshot: VoxelModelSnapshot
  ): void {
    const links = new ModelAnimationLinks();
    links.load(snapshot.animationSets);

    const materials = new ModelMaterials();
    materials.load(snapshot.materials);

    const nodes = createNodeTree();
    nodes.load(snapshot.nodes);
    for (const node of nodes.scan()) {
      if (!hasKnownMaterial(node, materials)) {
        throw new InvalidModelTreeError("node", node.id, "has no such material");
      }
    }

    this.#nodes = nodes;
    this.#materials = materials;
    this.#links = links;
  }

  clear(): void {
    this.#nodes.clear();
    this.#materials.clear();
    this.#links.clear();
  }

  toJSON(): VoxelModelSnapshot {
    return {
      nodes: [...this.#nodes.values()],
      materials: [...this.#materials.values()],
      animationSets: this.#links.toJSON()
    };
  }

  #isBlock(
    id: string
  ): boolean {
    return this.#nodes.peek(id)?.kind === "block";
  }

  #entries(
    which: ModelEntryTree
  ): OrderedTree<ModelNodeJSON> | OrderedTree<MaterialEntryJSON> {
    return which === "nodes" ? this.#nodes : this.#materials;
  }

  #dropMissingMaterials(): void {
    const orphans = [...this.#nodes.scan()].filter(
      (node) => !hasKnownMaterial(node, this.#materials)
    );
    for (const { id } of orphans) {
      this.#assignMaterial(id, null);
    }
  }

  #patchBlock(
    id: string,
    patch: Partial<Pick<BlockNodeJSON, "transform" | "uv">>
  ): void {
    this.#nodes.update(id, (node) => (node.kind === "block" ?
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
    this.#nodes.update(id, (node) => {
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

  #assignMaterial(
    id: string,
    materialId: string | null
  ): void {
    this.#nodes.update(id, (node) => {
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

  #transform(
    id: string,
    transform: BlockTransformJSON
  ): void {
    this.#patchBlock(id, { transform: structuredClone(transform) });
  }
}

function withoutBefore(
  command: VoxelModelCommand
): VoxelModelCommand {
  if (!("beforeId" in command)) {
    return command;
  }

  const { beforeId: _beforeId, ...placed } = command;

  return placed;
}

function createNodeTree(): OrderedTree<ModelNodeJSON> {
  return new OrderedTree<ModelNodeJSON>({
    kind: "node",
    canContain: () => true
  });
}

function hasKnownMaterial(
  node: ModelNodeJSON,
  materials: ModelMaterialsReader
): boolean {
  return node.kind === "folder" ||
    node.materialId === undefined ||
    materials.material(node.materialId) !== undefined;
}
