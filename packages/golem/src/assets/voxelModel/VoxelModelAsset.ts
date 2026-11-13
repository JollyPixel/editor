// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Third-party Dependencies
import { PIXEL_ART_KIND } from "@jolly-pixel/asset.pixel-art/client";
import {
  BlockNode,
  BlockShape,
  BlockTransform,
  BlockUvLayouts,
  MaterialSurface,
  VOXEL_MODEL_PRESENCE_KEYS,
  linkedTextureId,
  modelFootprint,
  type BlockShapeJSON,
  type BlockTransformJSON,
  type MaterialSurfaceJSON,
  type ModelTreeReader,
  type SyncedModelDocument,
  type VoxelModelCommand,
  type VoxelModelSnapshot
} from "@jolly-pixel/asset.voxel-model/client";
import type { VoxelModelEditableKind } from "@jolly-pixel/asset.voxel-model/server";
import type {
  PeerMetadata,
  Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  GolemAsset,
  type AssetOpening,
  type CatalogReader
} from "../GolemAsset.ts";
import type { PixelArtAsset } from "../pixelArt/PixelArtAsset.ts";
import type { PixelRect } from "../pixelArt/PixelSurface.ts";
import { resolveEntry } from "../resolveEntry.ts";
import { assertModelUnlocked } from "./assertModelUnlocked.ts";

export interface BlockSpec {
  name: string;
  /**
   * @default { type: "box" }
   */
  shape?: BlockShapeJSON;
  /**
   * Missing fields: position, rotation and pivot offset 0, size and scale 1.
   */
  transform?: Partial<BlockTransformJSON>;
  /**
   * A material name or id.
   * @default the model's default look
   */
  material?: string;
}

export interface AddBlocksOptions {
  /**
   * The name or id of the node the blocks go under; `null` for the root.
   * @default null
   */
  parent?: string | null;
}

export interface MaterialSpec {
  name: string;
  /**
   * Missing fields take the default surface.
   */
  surface?: Partial<MaterialSurfaceJSON>;
}

export interface AddedEntry {
  id: string;
  name: string;
}

export interface AddedBlock extends AddedEntry {
  /**
   * The bounds of the block's faces on the model's texture, in pixels.
   */
  uv: PixelRect;
  /**
   * `true` when the texture had no free space left, so the faces overlap
   * another block's.
   */
  shared: boolean;
}

export class VoxelModelAsset extends GolemAsset<
  VoxelModelCommand,
  SyncedModelDocument
> {
  #room: Room;
  #catalog: CatalogReader;
  #open: AssetOpening["open"];

  constructor(
    opening: AssetOpening,
    kind: VoxelModelEditableKind
  ) {
    super(opening, kind);
    this.#room = opening.room;
    this.#catalog = opening.catalog;
    this.#open = opening.open;
  }

  get tree(): ModelTreeReader {
    return this.synced.document.tree;
  }

  read(): VoxelModelSnapshot {
    return this.tree.toJSON();
  }

  async addBlocks(
    specs: Iterable<BlockSpec>,
    options: AddBlocksOptions = {}
  ): Promise<AddedBlock[]> {
    const { parent = null } = options;
    const parentId = parent === null ?
      null :
      resolveEntry("node", parent, this.tree.nodes.values()).id;
    const blocks = Array.from(specs, (spec) => {
      return {
        name: spec.name,
        shape: spec.shape ?? BlockShape.box,
        transform: BlockTransform.create(spec.transform),
        ...spec.material === undefined ?
          {} :
          { materialId: this.#material(spec.material) }
      };
    });
    const texture = await this.#texture();
    const size = texture.pixels.size;
    const { textureSize, nets } = new BlockUvLayouts(
      Array.from(this.tree.nodes.blocks(), (block) => block.uv)
    ).place(
      blocks.map(({ shape }) => shape),
      size,
      texture.pixels.maxSize
    );
    const added: AddedBlock[] = [];
    const commands = blocks.map(({ shape, ...block }, index): VoxelModelCommand => {
      const id = randomUUID();
      const { uv, bounds, shared } = nets[index];
      added.push({
        id,
        name: block.name,
        uv: bounds,
        shared
      });

      return {
        action: "node-added",
        node: BlockNode.create({
          id,
          parentId,
          uv,
          shape,
          ...block
        })
      };
    });
    this.guard(commands);
    if (textureSize.x !== size.x || textureSize.y !== size.y) {
      await texture.pixels.resize(textureSize);
      await texture.settled();
    }
    await this.applyInBatches(commands);

    return added;
  }

  async addMaterials(
    specs: Iterable<MaterialSpec>
  ): Promise<AddedEntry[]> {
    const added: AddedEntry[] = [];
    const commands = Array.from(specs, (spec): VoxelModelCommand => {
      const id = randomUUID();
      added.push({
        id,
        name: spec.name
      });

      return {
        action: "material-added",
        material: {
          kind: "material",
          id,
          parentId: null,
          name: spec.name,
          surface: MaterialSurface.create(spec.surface)
        }
      };
    });
    await this.applyInBatches(commands);

    return added;
  }

  protected focus(
    commands: readonly VoxelModelCommand[]
  ): PeerMetadata | null {
    for (const command of commands.toReversed()) {
      const nodeId = modelFootprint(command).node;
      if (nodeId !== null && this.tree.nodes.block(nodeId) !== undefined) {
        return { [VOXEL_MODEL_PRESENCE_KEYS.block]: nodeId };
      }
    }

    return null;
  }

  protected override guard(
    commands: readonly VoxelModelCommand[]
  ): void {
    assertModelUnlocked(this.#room, commands);
  }

  #texture(): Promise<PixelArtAsset> {
    return this.#open(
      linkedTextureId(this.#catalog.dependencies, this.id),
      PIXEL_ART_KIND
    );
  }

  #material(
    nameOrId: string
  ): string {
    const materials = [...this.tree.materials.values()]
      .filter(({ kind }) => kind === "material");

    return resolveEntry("material", nameOrId, materials).id;
  }
}
