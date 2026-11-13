// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  VoxelModelCommand,
  VoxelModelSnapshot
} from "./types.ts";
import {
  ModelAnimationLinks,
  type ModelAnimationLinksReader
} from "./animation/ModelAnimationLinks.ts";
import {
  acceptsModelCommand,
  applyModelCommand,
  placeModelCommand
} from "./command/modelCommands.ts";
import {
  ModelMaterials,
  type ModelMaterialsReader
} from "./materials/ModelMaterials.ts";
import {
  ModelNodes,
  type ModelNodesReader
} from "./nodes/ModelNodes.ts";

export type ModelTreeReader = Pick<
  ModelTree,
  | "nodes"
  | "materials"
  | "animationSets"
  | "toJSON"
>;

export class ModelTree {
  #nodes = new ModelNodes();
  #materials = new ModelMaterials();
  #links = new ModelAnimationLinks();

  get nodes(): ModelNodesReader {
    return this.#nodes;
  }

  get materials(): ModelMaterialsReader {
    return this.#materials;
  }

  get animationSets(): ModelAnimationLinksReader {
    return this.#links;
  }

  accepts(
    command: VoxelModelCommand
  ): boolean {
    return acceptsModelCommand(this, command);
  }

  placeable(
    command: VoxelModelCommand
  ): VoxelModelCommand {
    return placeModelCommand(this, command);
  }

  apply(
    command: VoxelModelCommand
  ): void {
    applyModelCommand({
      nodes: this.#nodes,
      materials: this.#materials,
      animationSets: this.#links
    }, command);
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
      if (node.kind === "block" && !materials.isAssignable(node.materialId)) {
        throw new InvalidEntryError("node", node.id, "has no such material");
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
}
