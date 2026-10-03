// Import Third-party Dependencies
import {
  BlockTextureLayout,
  isLocalBlockId,
  localBlockIdOf,
  tileRectOf,
  WHOLE_TILE_BOUNDS,
  type BlockShape,
  type ResolvedBlockDefinition,
  type TileSpan
} from "@jolly-pixel/voxel.renderer";
import {
  DEFAULT_UV_SLOTS,
  rotateGeometry,
  withRotation,
  type IslandFace,
  type UVGeometry,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  uvGeometryForSlot,
  type BlockShapeUv
} from "./blockShapeUv.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kBoxShapeUv: BlockShapeUv = {
  activeFaces: [...DEFAULT_UV_SLOTS],
  bounds: Object.fromEntries(
    DEFAULT_UV_SLOTS.map((slot) => [slot, WHOLE_TILE_BOUNDS])
  ),
  spans: {},
  triangles: {},
  parts: {},
  faceRanges: {},
  isBox: true
};

export class BlockProjection {
  static regionIdOf(
    localBlockId: number
  ): string {
    return `${kRegionIdPrefix}${localBlockId}`;
  }

  static localBlockIdOf(
    regionId: string
  ): number | null {
    if (!regionId.startsWith(kRegionIdPrefix)) {
      return null;
    }
    const value = Number(regionId.slice(kRegionIdPrefix.length));

    return isLocalBlockId(value) ? value : null;
  }

  readonly block: ResolvedBlockDefinition;
  readonly shape: BlockShape | undefined;
  readonly tileSize: number;
  readonly layout: BlockTextureLayout;
  readonly shapeUv: BlockShapeUv;

  constructor(
    block: ResolvedBlockDefinition,
    shape: BlockShape | undefined,
    tileSize: number
  ) {
    this.block = block;
    this.shape = shape;
    this.tileSize = tileSize;
    this.layout = BlockTextureLayout.of(block, shape);
    this.shapeUv = shape === undefined ? kBoxShapeUv : blockShapeUv(shape);
  }

  get regionId(): string {
    return BlockProjection.regionIdOf(localBlockIdOf(this.block.id));
  }

  get textured(): boolean {
    return this.layout.slots.length > 0;
  }

  get isBox(): boolean {
    return this.shapeUv.isBox;
  }

  faces(): Record<UVSlot, UVGeometry> {
    return Object.fromEntries(
      this.#faceEntries((slot) => this.shapeUv.spans[slot])
    );
  }

  stackedFaces(): Record<UVSlot, UVGeometry> {
    return Object.fromEntries(this.#faceEntries(() => undefined));
  }

  islandFaces(): IslandFace[] {
    const regionId = this.regionId;

    return this.#faceEntries((_slot, span) => span).map(([, geometry]) => {
      return {
        regionId,
        geometry
      };
    });
  }

  #faceEntries(
    spanOf: (
      slot: UVSlot,
      sampledSpan: Readonly<TileSpan>
    ) => Readonly<TileSpan> | undefined
  ): [UVSlot, UVGeometry][] {
    return this.layout.slots.map((
      { slot, tile, span }
    ): [UVSlot, UVGeometry] => {
      const rect = tileRectOf(
        tile,
        this.tileSize,
        this.shapeUv.bounds[slot],
        spanOf(slot, span)
      );
      const rotation = tile.rotation ?? 0;
      const rotated = rotateGeometry(
        uvGeometryForSlot(rect, this.shapeUv, slot),
        rotation
      );

      return [
        slot,
        "shape" in rotated ?
          { ...rotated, rect } :
          withRotation(rect, rotation)
      ];
    });
  }
}
