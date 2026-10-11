// Import Third-party Dependencies
import {
  MaterialGroup,
  type BlockDefinition,
  type BlocksetSlot,
  type MaterialGroupChanges,
  type MaterialGroupList,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MapMaterial } from "./MapMaterial.ts";
import { MaterialSwatch } from "./MaterialSwatch.ts";

// CONSTANTS
const kDefaultName = "Material";

export type MaterialRename = "renamed" | "unchanged" | "taken";

export interface MaterialSources {
  readonly blocks: {
    get(blockId: number): ResolvedBlockDefinition | undefined;
    getAll(): Iterable<ResolvedBlockDefinition>;
  };
  readonly materialGroups: MaterialGroupList;
}

export interface MaterialBlocksets {
  findOwner(blockId: number): { readonly slot: BlocksetSlot; } | undefined;
  defineBlock(block: BlockDefinition): boolean;
  defineMaterialGroup(group: MaterialGroup): boolean;
  removeMaterialGroup(groupId: string): boolean;
  renameMaterialGroup(groupId: string, to: string): boolean;
}

export interface MapMaterialsOptions {
  document: MaterialSources;
  blocksets: MaterialBlocksets;
}

export class MapMaterials {
  readonly #document: MaterialSources;
  readonly #blocksets: MaterialBlocksets;

  constructor(
    options: MapMaterialsOptions
  ) {
    this.#document = options.document;
    this.#blocksets = options.blocksets;
  }

  findForBlock(
    blockId: number
  ): MapMaterial | undefined {
    return this.availableTo(blockId).find(
      (material) => material.usedBy(blockId)
    );
  }

  availableTo(
    blockId: number
  ): MapMaterial[] {
    const slot = this.#blocksets.findOwner(blockId)?.slot;

    return slot === undefined ? [] : this.inSlot(slot);
  }

  inSlot(
    slot: BlocksetSlot
  ): MapMaterial[] {
    const { blocks, materialGroups } = this.#document;
    const users = new Map<string, number[]>();
    for (const group of materialGroups) {
      if (slot.decodeLocalGroupId(group.id) !== null) {
        users.set(group.id, []);
      }
    }
    for (const block of blocks.getAll()) {
      const groupId = block.materialGroup;
      if (groupId === undefined || slot.decodeLocalGroupId(groupId) === null) {
        continue;
      }

      const blockIds = users.get(groupId) ?? [];
      blockIds.push(block.id);
      users.set(groupId, blockIds);
    }

    return Array.from(users, ([id, blockIds]) => new MapMaterial({
      slot,
      finish: materialGroups.get(id) ?? new MaterialGroup({ id }),
      blockIds
    })).sort((left, right) => left.name.localeCompare(right.name));
  }

  swatches(): Map<number, MaterialSwatch> {
    const byGroup = new Map<string, MaterialSwatch>();
    const swatches = new Map<number, MaterialSwatch>();
    for (const block of this.#document.blocks.getAll()) {
      const groupId = block.materialGroup;
      if (groupId === undefined) {
        continue;
      }

      let swatch = byGroup.get(groupId);
      if (swatch === undefined) {
        swatch = MaterialSwatch.fromMaterial(
          groupId,
          this.#document.materialGroups.get(groupId)
        );
        byGroup.set(groupId, swatch);
      }
      swatches.set(block.id, swatch);
    }

    return swatches;
  }

  assign(
    blockId: number,
    material: MapMaterial | null
  ): boolean {
    const block = this.#document.blocks.get(blockId);
    const groupId = material?.id;
    if (block === undefined || block.materialGroup === groupId) {
      return false;
    }

    return this.#blocksets.defineBlock(withMaterialGroup(block, groupId));
  }

  create(
    slot: BlocksetSlot
  ): string | null {
    const groupId = slot.qualifyGroupId(this.#freeName(slot));
    const defined = this.#blocksets.defineMaterialGroup(
      new MaterialGroup({
        id: groupId,
        swatch: MaterialSwatch.derivedColor(groupId)
      })
    );

    return defined ? groupId : null;
  }

  refinish(
    material: MapMaterial,
    changes: MaterialGroupChanges
  ): boolean {
    const current = this.#document.materialGroups.get(material.id) ??
      material.finish;
    const next = MaterialGroup.parse({
      ...current.toJSON(),
      ...changes
    });
    if (next === null || next.equals(current)) {
      return false;
    }

    return this.#blocksets.defineMaterialGroup(next);
  }

  rename(
    material: MapMaterial,
    name: string
  ): MaterialRename {
    const localName = name.trim();
    if (localName === "" || localName === material.name) {
      return "unchanged";
    }

    const renamed = this.#blocksets.renameMaterialGroup(
      material.id,
      material.slot.qualifyGroupId(localName)
    );

    return renamed ? "renamed" : "taken";
  }

  remove(
    material: MapMaterial
  ): void {
    for (const blockId of material.blockIds) {
      const block = this.#document.blocks.get(blockId);
      if (block !== undefined) {
        this.#blocksets.defineBlock(withMaterialGroup(block, undefined));
      }
    }
    this.#blocksets.removeMaterialGroup(material.id);
  }

  #freeName(
    slot: BlocksetSlot
  ): string {
    let name = kDefaultName;
    for (let index = 2; this.#taken(slot.qualifyGroupId(name)); index++) {
      name = `${kDefaultName} ${index}`;
    }

    return name;
  }

  #taken(
    groupId: string
  ): boolean {
    if (this.#document.materialGroups.has(groupId)) {
      return true;
    }

    for (const block of this.#document.blocks.getAll()) {
      if (block.materialGroup === groupId) {
        return true;
      }
    }

    return false;
  }
}

function withMaterialGroup(
  block: ResolvedBlockDefinition,
  groupId: string | undefined
): ResolvedBlockDefinition {
  const { materialGroup: _materialGroup, ...rest } = block;

  return groupId === undefined ?
    rest :
    {
      ...rest,
      materialGroup: groupId
    };
}
