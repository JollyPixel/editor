// Import Third-party Dependencies
import type {
  BlocksetSlot,
  MaterialGroup
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { MaterialSwatch } from "./MaterialSwatch.ts";

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
}
