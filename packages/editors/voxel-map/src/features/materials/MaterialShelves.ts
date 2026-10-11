// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import type { BlocksetSlot } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapMaterial } from "./MapMaterial.ts";

// CONSTANTS
const kShelfPrefix = "blockset:";

export interface MaterialShelf {
  readonly blocksetId: string;
  readonly label: string;
  readonly slot: BlocksetSlot;
  readonly materials: readonly MapMaterial[];
  readonly editable: boolean;
}

export class MaterialShelves implements Iterable<MaterialShelf> {
  static shelfNodeId(
    blocksetId: string
  ): string {
    return `${kShelfPrefix}${blocksetId}`;
  }

  readonly #shelves: readonly MaterialShelf[];

  constructor(
    shelves: Iterable<MaterialShelf>
  ) {
    this.#shelves = Object.freeze([...shelves]);
  }

  get size(): number {
    return this.#shelves.length;
  }

  get editableShelves(): MaterialShelf[] {
    return this.#shelves.filter((shelf) => shelf.editable);
  }

  get materialCount(): number {
    return this.#shelves.reduce(
      (count, shelf) => count + shelf.materials.length,
      0
    );
  }

  material(
    materialId: string
  ): MapMaterial | undefined {
    for (const shelf of this.#shelves) {
      const material = shelf.materials.find(
        (entry) => entry.id === materialId
      );
      if (material !== undefined) {
        return material;
      }
    }

    return undefined;
  }

  findShelf(
    nodeId: string
  ): MaterialShelf | undefined {
    return this.#shelves.find(
      (shelf) => MaterialShelves.shelfNodeId(shelf.blocksetId) === nodeId ||
        shelf.materials.some((material) => material.id === nodeId)
    );
  }

  has(
    nodeId: string
  ): boolean {
    return this.findShelf(nodeId) !== undefined;
  }

  canEdit(
    materialId: string
  ): boolean {
    return this.findShelf(materialId)?.editable === true;
  }

  toTreeNodes(): TreeNode[] {
    if (this.#shelves.length === 1) {
      return materialNodes(this.#shelves[0]);
    }

    return this.#shelves.map((shelf) => {
      return {
        id: MaterialShelves.shelfNodeId(shelf.blocksetId),
        label: shelf.label,
        icon: "folder",
        collapsible: false,
        children: materialNodes(shelf)
      };
    });
  }

  * [Symbol.iterator](): IterableIterator<MaterialShelf> {
    yield* this.#shelves;
  }
}

function materialNodes(
  shelf: MaterialShelf
): TreeNode[] {
  return shelf.materials.map(
    (material) => materialNode(material, shelf.editable)
  );
}

function materialNode(
  material: MapMaterial,
  renamable: boolean
): TreeNode {
  const { color, glow } = material.swatch;
  const users = material.blockIds.length;

  return {
    id: material.id,
    label: material.name,
    renamable,
    ...(users === 0 ? {} : { detail: String(users) }),
    swatch: {
      title: `Swatch: ${material.name}`,
      color,
      ...(glow === null ? {} : { ring: glow })
    }
  };
}
