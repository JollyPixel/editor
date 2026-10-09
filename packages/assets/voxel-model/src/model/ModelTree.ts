// Import Third-party Dependencies
import type { NameSet } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  BlockNodeJSON,
  MaterialEntryJSON,
  ModelNodeJSON,
  VoxelModelCommand,
  VoxelModelSnapshot
} from "../network/types.ts";
import { InvalidModelTreeError } from "./errors/InvalidModelTreeError.ts";
import {
  ModelAnimationLinks,
  type ModelAnimationLinksReader
} from "./animation/ModelAnimationLinks.ts";
import {
  entryImagesOf,
  entrySlotOf,
  type ModelEntryTree
} from "./history/modelCommands.ts";
import type { ModelImages } from "./history/modelImages.ts";
import {
  ModelMaterials,
  type ModelMaterialsReader
} from "./materials/ModelMaterials.ts";
import { ModelNodes } from "./nodes/ModelNodes.ts";
import type { OrderedTree } from "./OrderedTree.ts";

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
  | "blockNamesUnder"
  | "blockNameClashes"
  | "placeable"
  | "materials"
  | "animationSets"
  | "blocksUsing"
  | "materialUses"
  | "accepts"
>;

export class ModelTree {
  #nodes = new ModelNodes();
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
    return this.#nodes.block(id);
  }

  materialIdOf(
    id: string
  ): string | undefined {
    return this.#nodes.materialIdOf(id);
  }

  values(): IterableIterator<ModelNodeJSON> {
    return this.#nodes.values();
  }

  blocks(): IterableIterator<BlockNodeJSON> {
    return this.#nodes.blocks();
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

  enclosingBlockOf(
    id: string | null
  ): string | null {
    return this.#nodes.enclosingBlockOf(id);
  }

  transformParentOf(
    id: string
  ): string | null {
    return this.#nodes.transformParentOf(id);
  }

  blockNamesUnder(
    parentId: string | null,
    exceptId?: string
  ): NameSet {
    return this.#nodes.blockNamesUnder(parentId, exceptId);
  }

  blockNameClashes(): Set<string> {
    return this.#nodes.blockNameClashes();
  }

  blocksUsing(
    materialId: string
  ): string[] {
    return this.#nodes.blocksUsing(materialId);
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

  imagesOf(
    command: VoxelModelCommand
  ): ModelImages {
    return entryImagesOf(this, command);
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
        return this.#nodes.accepts(command) &&
          hasKnownMaterial(command.node, this.#materials);
      case "node-material-changed":
        return this.#nodes.accepts(command) && (
          command.materialId === null ||
          this.#materials.material(command.materialId) !== undefined
        );
      case "node-removed":
      case "node-renamed":
      case "node-moved":
      case "node-transformed":
      case "node-uv-changed":
        return this.#nodes.accepts(command);
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
      case "node-removed":
      case "node-renamed":
      case "node-moved":
      case "node-transformed":
      case "node-uv-changed":
      case "node-material-changed":
        this.#nodes.apply(command);
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

    const nodes = new ModelNodes();
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
      this.#nodes.assignMaterial(id, null);
    }
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

function hasKnownMaterial(
  node: ModelNodeJSON,
  materials: ModelMaterialsReader
): boolean {
  return node.kind === "folder" ||
    node.materialId === undefined ||
    materials.material(node.materialId) !== undefined;
}
