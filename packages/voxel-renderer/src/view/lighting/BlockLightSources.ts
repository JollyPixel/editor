// Import Internal Dependencies
import type { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import { FACES } from "../../document/geometry/faceDirection.ts";
import type { MaterialGroup } from "../../document/materials/MaterialGroup.ts";
import type { MaterialGroupList } from "../../document/materials/MaterialGroupList.ts";
import {
  grayLight,
  LIGHT_OPAQUE,
  packLight,
  PACKED_LIGHT_MASK
} from "./packedLight.ts";
import { LightFalloff } from "./LightFalloff.ts";

export interface BlockLightSourcesOptions {
  blocks: BlockRegistry;
  shapes: BlockShapeRegistry;
  materialGroups: MaterialGroupList;
}

export class BlockLightSources {
  #blocks: BlockRegistry;
  #shapes: BlockShapeRegistry;
  #materialGroups: MaterialGroupList;
  #falloff = LightFalloff.WIDE;
  #flags = new Map<number, number>();
  #emits = false;

  constructor(
    options: BlockLightSourcesOptions
  ) {
    this.#blocks = options.blocks;
    this.#shapes = options.shapes;
    this.#materialGroups = options.materialGroups;
    this.refresh();
  }

  get emits(): boolean {
    return this.#emits;
  }

  get falloff(): LightFalloff {
    return this.#falloff;
  }

  switchFalloff(
    value: LightFalloff
  ): boolean {
    this.#falloff = value;

    return this.refresh();
  }

  resolveFlags(
    blockId: number
  ): number {
    let flags = this.#flags.get(blockId);
    if (flags === undefined) {
      flags = this.#resolve(blockId);
      this.#flags.set(blockId, flags);
    }

    return flags;
  }

  resolveEmission(
    blockId: number
  ): number {
    return this.resolveFlags(blockId) & PACKED_LIGHT_MASK;
  }

  isOpaque(
    blockId: number
  ): boolean {
    return (this.resolveFlags(blockId) & LIGHT_OPAQUE) !== 0;
  }

  refresh(): boolean {
    const previous = this.#flags;
    this.#flags = new Map();
    let emits = false;
    for (const { id } of this.#blocks) {
      if (this.resolveEmission(id) !== 0) {
        emits = true;
      }
    }
    this.#emits = emits;

    return this.#differsFrom(previous);
  }

  #differsFrom(
    previous: ReadonlyMap<number, number>
  ): boolean {
    for (const [blockId, flags] of previous) {
      if (this.resolveFlags(blockId) !== flags) {
        return true;
      }
    }
    for (const [blockId, flags] of this.#flags) {
      if ((previous.get(blockId) ?? 0) !== flags) {
        return true;
      }
    }

    return false;
  }

  #resolve(
    blockId: number
  ): number {
    const block = this.#blocks.get(blockId);
    if (block === undefined) {
      return 0;
    }

    const shape = this.#shapes.get(block.shapeId);
    const opaque = (block.alphaMode ?? "opaque") === "opaque" &&
      shape !== undefined &&
      FACES.every((face) => shape.occludes(face));
    const group = block.materialGroup === undefined ?
      undefined :
      this.#materialGroups.get(block.materialGroup);

    return (opaque ? LIGHT_OPAQUE : 0) |
      (group === undefined ? 0 : resolveEmission(group, this.#falloff));
  }
}

function resolveEmission(
  group: MaterialGroup,
  falloff: LightFalloff
): number {
  if (group.lightLevel === 0) {
    return 0;
  }

  const color = Number.parseInt(group.emissive.slice(1), 16);
  const red = (color >> 16) & 0xFF;
  const green = (color >> 8) & 0xFF;
  const blue = color & 0xFF;
  const peak = Math.max(red, green, blue);
  if (peak === 0) {
    return grayLight(group.lightLevel);
  }

  return packLight(
    falloff.tintedLevel(group.lightLevel, red / peak),
    falloff.tintedLevel(group.lightLevel, green / peak),
    falloff.tintedLevel(group.lightLevel, blue / peak)
  );
}
