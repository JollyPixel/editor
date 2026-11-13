// Import Third-party Dependencies
import {
  NameSet,
  OrderedTree
} from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  BlockNodeJSON,
  ModelNodeJSON
} from "../types.ts";

export type BlockPatch = Partial<
  Pick<BlockNodeJSON, "transform" | "flipAxes" | "shape" | "uv">
>;

export type MaterialBlockJSON = BlockNodeJSON & { materialId: string; };

export type ModelNodesReader = Pick<
  ModelNodes,
  | "size"
  | "has"
  | "get"
  | "canAdd"
  | "canMove"
  | "isSiblingSlot"
  | "isBlock"
  | "block"
  | "blockMaterialId"
  | "values"
  | "blocks"
  | "listChildren"
  | "findNextSibling"
  | "subtreeFrom"
  | "ancestorIds"
  | "findEnclosingBlock"
  | "findTransformParent"
  | "blockNamesUnder"
  | "blockNameClashes"
  | "blocksUsing"
  | "blocksUsingAny"
>;

export class ModelNodes extends OrderedTree<ModelNodeJSON> {
  static #usesAny(
    node: Readonly<ModelNodeJSON>,
    materialIds: ReadonlySet<string>
  ): node is Readonly<MaterialBlockJSON> {
    return node.kind === "block" &&
      node.materialId !== undefined &&
      materialIds.has(node.materialId);
  }

  constructor() {
    super({
      entry: "node"
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

  blockMaterialId(
    id: string
  ): string | undefined {
    const node = this.peek(id);

    return node?.kind === "block" ? node.materialId : undefined;
  }

  blocksUsing(
    materialId: string
  ): string[] {
    return Array.from(this.#scanUsing(new Set([materialId])), ({ id }) => id);
  }

  blocksUsingAny(
    materialIds: ReadonlySet<string>
  ): MaterialBlockJSON[] {
    return Array.from(this.#scanUsing(materialIds), (block) => structuredClone(block));
  }

  findEnclosingBlock(
    id: string | null
  ): string | null {
    if (id === null) {
      return null;
    }

    for (const candidate of [id, ...this.ancestorIds(id)]) {
      const node = this.peek(candidate);
      if (node === undefined) {
        return null;
      }
      if (node.kind === "block") {
        return node.id;
      }
    }

    return null;
  }

  findTransformParent(
    id: string
  ): string | null {
    return this.findEnclosingBlock(this.peek(id)?.parentId ?? null);
  }

  blockNamesUnder(
    parentId: string | null,
    exceptId?: string
  ): NameSet {
    const blockParent = this.findEnclosingBlock(parentId);
    const names: string[] = [];
    for (const node of this.scan()) {
      if (
        node.kind === "block" &&
        node.id !== exceptId &&
        this.findTransformParent(node.id) === blockParent
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
        const parent = this.findTransformParent(node.id);
        const byName = byParent.get(parent) ?? new Map<string, string[]>();
        const key = NameSet.toKey(node.name);
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

  rename(
    id: string,
    name: string
  ): void {
    this.update(id, (node) => {
      return {
        ...node,
        name
      };
    });
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

  dropMaterials(
    materialIds: ReadonlySet<string>
  ): void {
    for (const { id } of [...this.#scanUsing(materialIds)]) {
      this.assignMaterial(id, null);
    }
  }

  patchBlock(
    id: string,
    patch: BlockPatch
  ): void {
    this.update(id, (node) => (node.kind === "block" ?
      {
        ...node,
        ...structuredClone(patch)
      } :
      node));
  }

  * #scanUsing(
    materialIds: ReadonlySet<string>
  ): IterableIterator<Readonly<MaterialBlockJSON>> {
    for (const node of this.scan()) {
      if (ModelNodes.#usesAny(node, materialIds)) {
        yield node;
      }
    }
  }
}
