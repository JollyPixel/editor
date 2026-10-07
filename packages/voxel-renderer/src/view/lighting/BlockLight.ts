// Import Internal Dependencies
import type { BlockRegistry } from "../../document/blocks/BlockRegistry.ts";
import type { BlockShapeRegistry } from "../../document/blocks/shape/BlockShapeRegistry.ts";
import type { MaterialGroupList } from "../../document/materials/MaterialGroupList.ts";
import type { VoxelWorld } from "../../document/world/VoxelWorld.ts";
import type { MeshableLayerVisibility } from "../meshing/types.ts";
import { BlockLightSources } from "./BlockLightSources.ts";
import { BlockLightField } from "./BlockLightField.ts";
import { ChunkLightTextures } from "./ChunkLightTextures.ts";
import type { LightChunkKey } from "./LightGrid.ts";
import type { LightFalloff } from "./LightFalloff.ts";

export interface BlockLightOptions {
  world: VoxelWorld;
  blocks: BlockRegistry;
  shapes: BlockShapeRegistry;
  materialGroups: MaterialGroupList;
  visibility: MeshableLayerVisibility;
}

export class BlockLight {
  readonly textures: ChunkLightTextures;

  #sources: BlockLightSources;
  #field: BlockLightField;

  constructor(
    options: BlockLightOptions
  ) {
    const { world, blocks, shapes, materialGroups, visibility } = options;

    this.#sources = new BlockLightSources({
      blocks,
      shapes,
      materialGroups
    });
    this.#field = new BlockLightField({
      world,
      sources: this.#sources,
      visibility
    });
    this.textures = new ChunkLightTextures({
      field: this.#field,
      sources: this.#sources
    });
  }

  get falloff(): LightFalloff {
    return this.#sources.falloff;
  }

  set falloff(
    value: LightFalloff
  ) {
    if (this.#sources.switchFalloff(value)) {
      this.#field.invalidate();
    }
    else {
      this.#field.repaint();
    }
  }

  refreshSources(): void {
    if (this.#sources.refresh()) {
      this.#field.invalidate();
    }
  }

  invalidate(): void {
    this.#sources.refresh();
    this.#field.invalidate();
  }

  update(): ReadonlySet<LightChunkKey> {
    return this.#field.update();
  }
}
