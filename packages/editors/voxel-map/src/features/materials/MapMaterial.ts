// Import Third-party Dependencies
import {
  MaterialGroup,
  type BlocksetSlot,
  type MaterialGroupFinish,
  type ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MaterialSwatch } from "./MaterialSwatch.ts";

// CONSTANTS
export const FINISH_FIELDS = [
  "roughness",
  "metalness",
  "normalScale",
  "emissive",
  "emissiveIntensity",
  "lightLevel"
] as const satisfies readonly FinishField[];

export type FinishField = keyof MaterialGroupFinish;

export type SelectedBlockUse =
  | {
    kind: "apply" | "unapply";
    block: ResolvedBlockDefinition;
  }
  | {
    kind: "blocked";
    reason: string;
  };

export interface MapMaterialOptions {
  slot: BlocksetSlot;
  finish: MaterialGroup;
  blockIds?: Iterable<number>;
}

export class MapMaterial {
  readonly slot: BlocksetSlot;
  readonly finish: MaterialGroup;
  readonly blockIds: readonly number[];

  constructor(
    options: MapMaterialOptions
  ) {
    this.slot = options.slot;
    this.finish = options.finish;
    this.blockIds = Object.freeze([...options.blockIds ?? []]);

    Object.freeze(this);
  }

  get id(): string {
    return this.finish.id;
  }

  get name(): string {
    return this.slot.decodeLocalGroupId(this.id) ?? this.id;
  }

  get swatch(): MaterialSwatch {
    return MaterialSwatch.fromMaterial(this.id, this.finish);
  }

  usedBy(
    blockId: number
  ): boolean {
    return this.blockIds.includes(blockId);
  }

  isDefault(
    fields: readonly FinishField[] = FINISH_FIELDS
  ): boolean {
    const { defaults } = MaterialGroup;

    return fields.every((field) => this.finish[field] === defaults[field]);
  }

  useOn(
    block: ResolvedBlockDefinition | undefined,
    canEditBlock: (blockId: number) => boolean
  ): SelectedBlockUse {
    if (block === undefined) {
      return blocked("Select a block to apply this material");
    }
    if (!this.slot.ownsBlockId(block.id)) {
      return blocked(`${block.name} belongs to another blockset`);
    }
    if (!canEditBlock(block.id)) {
      return blocked("You can only view the blocks of this blockset");
    }

    return {
      kind: this.usedBy(block.id) ? "unapply" : "apply",
      block
    };
  }
}

function blocked(
  reason: string
): SelectedBlockUse {
  return {
    kind: "blocked",
    reason
  };
}
