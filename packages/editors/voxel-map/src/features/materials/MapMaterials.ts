// Import Third-party Dependencies
import {
  MaterialGroup,
  type BlockDefinition,
  type BlocksetSlot,
  type MaterialGroupChanges,
  type MaterialGroupFinish,
  type MaterialGroupList,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  FINISH_FIELDS,
  MapMaterial,
  type FinishField
} from "./MapMaterial.ts";
import { MaterialSwatch } from "./MaterialSwatch.ts";

// CONSTANTS
const kDefaultName = "Material";
const kCopySuffix = " copy";

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
  sources: MaterialSources;
  blocksets: MaterialBlocksets;
}

export class MapMaterials {
  readonly #sources: MaterialSources;
  readonly #blocksets: MaterialBlocksets;

  constructor(
    options: MapMaterialsOptions
  ) {
    this.#sources = options.sources;
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
    const { blocks, materialGroups } = this.#sources;
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
    for (const block of this.#sources.blocks.getAll()) {
      const groupId = block.materialGroup;
      if (groupId === undefined) {
        continue;
      }

      let swatch = byGroup.get(groupId);
      if (swatch === undefined) {
        swatch = MaterialSwatch.fromMaterial(
          groupId,
          this.#sources.materialGroups.get(groupId)
        );
        byGroup.set(groupId, swatch);
      }
      swatches.set(block.id, swatch);
    }

    return swatches;
  }

  assign(
    blockId: number,
    groupId: string | null
  ): boolean {
    const block = this.#sources.blocks.get(blockId);
    const next = groupId ?? undefined;
    if (block === undefined || block.materialGroup === next) {
      return false;
    }

    return this.#blocksets.defineBlock(withMaterialGroup(block, next));
  }

  create(
    slot: BlocksetSlot
  ): string | null {
    return this.#define(slot, kDefaultName);
  }

  duplicate(
    material: MapMaterial
  ): string | null {
    return this.#define(
      material.slot,
      `${material.name}${kCopySuffix}`,
      this.#currentFinish(material).toJSON()
    );
  }

  createForBlock(
    blockId: number
  ): string | null {
    const block = this.#sources.blocks.get(blockId);
    const slot = this.#blocksets.findOwner(blockId)?.slot;
    if (block === undefined || slot === undefined) {
      return null;
    }

    const groupId = this.create(slot);

    return groupId !== null && this.assign(blockId, groupId) ? groupId : null;
  }

  refinish(
    material: MapMaterial,
    changes: MaterialGroupChanges
  ): boolean {
    const current = this.#currentFinish(material);
    const next = MaterialGroup.parse({
      ...current.toJSON(),
      ...changes
    });
    if (next === null || next.equals(current)) {
      return false;
    }

    return this.#blocksets.defineMaterialGroup(next);
  }

  resetFinish(
    material: MapMaterial,
    fields: readonly FinishField[] = FINISH_FIELDS
  ): boolean {
    const changes: Partial<MaterialGroupFinish> = {};
    for (const field of fields) {
      copyDefault(changes, field);
    }

    return this.refinish(material, changes);
  }

  isNameTaken(
    material: MapMaterial,
    name: string
  ): boolean {
    const groupId = material.slot.qualifyGroupId(name.trim());

    return groupId !== material.id && this.#taken(groupId);
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
      const block = this.#sources.blocks.get(blockId);
      if (block !== undefined) {
        this.#blocksets.defineBlock(withMaterialGroup(block, undefined));
      }
    }
    this.#blocksets.removeMaterialGroup(material.id);
  }

  #define(
    slot: BlocksetSlot,
    base: string,
    finish: MaterialGroupChanges = {}
  ): string | null {
    const groupId = slot.qualifyGroupId(this.#freeName(slot, base));
    const defined = this.#blocksets.defineMaterialGroup(
      new MaterialGroup({
        ...finish,
        id: groupId,
        swatch: MaterialSwatch.derivedColor(groupId)
      })
    );

    return defined ? groupId : null;
  }

  #currentFinish(
    material: MapMaterial
  ): MaterialGroup {
    return this.#sources.materialGroups.get(material.id) ?? material.finish;
  }

  #freeName(
    slot: BlocksetSlot,
    base: string
  ): string {
    let name = base;
    for (let index = 2; this.#taken(slot.qualifyGroupId(name)); index++) {
      name = `${base} ${index}`;
    }

    return name;
  }

  #taken(
    groupId: string
  ): boolean {
    if (this.#sources.materialGroups.has(groupId)) {
      return true;
    }

    for (const block of this.#sources.blocks.getAll()) {
      if (block.materialGroup === groupId) {
        return true;
      }
    }

    return false;
  }
}

function copyDefault<TField extends FinishField>(
  changes: Partial<MaterialGroupFinish>,
  field: TField
): void {
  changes[field] = MaterialGroup.defaults[field];
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
