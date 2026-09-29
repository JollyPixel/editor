// Import Third-party Dependencies
import {
  BlockTextureLayout,
  BlockTextures,
  tileRectOf,
  tileRefFromRect,
  WHOLE_TILE_BOUNDS,
  type BlockShape,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import {
  DEFAULT_UV_SLOTS,
  UVRegion,
  rotateGeometry,
  rotationOf,
  type SelectionRect,
  type UVGeometry,
  type UVQuarterTurn,
  type UVRect,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  uvGeometryForSlot,
  type BlockShapeUv
} from "../../../shared/blockShapeUv.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";
const kBoxShapeUv: BlockShapeUv = {
  activeFaces: [...DEFAULT_UV_SLOTS],
  bounds: recordOfFaces(() => WHOLE_TILE_BOUNDS),
  spans: {},
  triangles: {},
  parts: {},
  faceRanges: {},
  isBox: true
};

export class BlockUv {
  static regionIdOf(
    blockId: number
  ): string {
    return `${kRegionIdPrefix}${blockId}`;
  }

  static blockIdOf(
    regionId: string
  ): number | null {
    if (!regionId.startsWith(kRegionIdPrefix)) {
      return null;
    }
    const value = Number(regionId.slice(kRegionIdPrefix.length));

    return Number.isNaN(value) ? null : value;
  }

  static sameRegion(
    left: UVRegion,
    right: UVRegion
  ): boolean {
    const a = left.toJSON();
    const b = right.toJSON();
    if (
      a.state !== b.state ||
      a.name !== b.name ||
      a.color !== b.color ||
      left.stackedFace !== right.stackedFace
    ) {
      return false;
    }
    if (a.state === "stacked" && b.state === "stacked") {
      return rectsEqual(a.rect, b.rect) &&
        rotationOf(a.rect) === rotationOf(b.rect) &&
        geometriesEqual(a.faces, b.faces);
    }
    if (a.state !== "stacked" && b.state !== "stacked") {
      return arraysEqual(a.activeFaces ?? [], b.activeFaces ?? []) &&
        geometriesEqual(a.faces, b.faces);
    }

    return false;
  }

  readonly block: ResolvedBlockDefinition;
  readonly shape: BlockShape | undefined;
  readonly tileSize: number;
  readonly #layout: BlockTextureLayout;
  readonly #shapeUv: BlockShapeUv;

  constructor(
    block: ResolvedBlockDefinition,
    shape: BlockShape | undefined,
    tileSize: number
  ) {
    this.block = block;
    this.shape = shape;
    this.tileSize = tileSize;
    this.#layout = BlockTextureLayout.of(block, shape);
    this.#shapeUv = shape === undefined ? kBoxShapeUv : blockShapeUv(shape);
  }

  get textured(): boolean {
    return this.#layout.slots.length > 0;
  }

  get isBox(): boolean {
    return this.#shapeUv.isBox;
  }

  get regionId(): string {
    return BlockUv.regionIdOf(this.block.id);
  }

  usesTileset(
    tilesetId: string
  ): boolean {
    return this.#layout.usesTileset(tilesetId);
  }

  region(): UVRegion {
    const { block } = this;
    const hasFaceTextures = Object.keys(block.faceTextures ?? {}).length > 0;
    if (hasFaceTextures || !block.defaultTexture) {
      return this.freeRegion();
    }

    if (this.#shapeUv.isBox) {
      return new UVRegion({
        id: this.regionId,
        name: block.name,
        color: kRegionColor,
        state: "stacked",
        rect: rotatedRect(
          tileRectOf(block.defaultTexture, this.tileSize),
          block.defaultTexture.rotation ?? 0
        )
      });
    }

    return this.#freeRegion({
      ...this.#shapeUv,
      spans: {}
    }).stack();
  }

  freeRegion(): UVRegion {
    return this.#freeRegion(this.#shapeUv);
  }

  apply(
    region: UVRegion
  ): ResolvedBlockDefinition {
    const { block, tileSize } = this;
    const shapeUv = this.#shapeUv;
    const textures = BlockTextures.of(block);
    const stackedSlot = region.stackedFace ??
      shapeUv.activeFaces[0] ??
      "front";

    if (region.state !== "stacked") {
      return {
        ...block,
        faceTextures: Object.fromEntries(
          region.slots.map((face) => {
            const template = textures.forSlot(face);
            if (!template) {
              throw new RangeError(`No texture template for UV slot "${face}"`);
            }

            const geometry = region.geometryFor(face);

            return [
              face,
              tileRefFromRect(
                "shape" in geometry ? geometry.rect : geometry,
                withTileRotation(template, rotationOf(geometry)),
                tileSize,
                shapeUv.bounds[face],
                shapeUv.spans[face]
              )
            ];
          })
        )
      };
    }

    const template = textures.forSlot(stackedSlot);
    if (!template) {
      throw new RangeError(
        `No texture template for UV slot "${stackedSlot}"`
      );
    }

    return {
      ...block,
      faceTextures: {},
      defaultTexture: tileRefFromRect(
        region.rectFor(stackedSlot),
        withTileRotation(
          template,
          rotationOf(region.geometryFor(stackedSlot))
        ),
        tileSize,
        shapeUv.bounds[stackedSlot]
      )
    };
  }

  #freeRegion(
    shapeUv: BlockShapeUv
  ): UVRegion {
    const textureSlots = this.#layout.slots;
    const faces = Object.fromEntries(
      textureSlots.map(({ slot, tile }): [UVSlot, UVGeometry] => {
        const rect = tileRectOf(
          tile,
          this.tileSize,
          shapeUv.bounds[slot],
          shapeUv.spans[slot]
        );
        const rotation = tile.rotation ?? 0;
        const rotated = rotateGeometry(
          uvGeometryForSlot(rect, shapeUv, slot),
          rotation
        );

        return [
          slot,
          "shape" in rotated ?
            { ...rotated, rect } :
            rotatedRect(rect, rotation)
        ];
      })
    ) as Record<UVSlot, UVGeometry>;

    return new UVRegion({
      id: this.regionId,
      name: this.block.name,
      color: kRegionColor,
      state: "free",
      faces,
      activeFaces: textureSlots.map(({ slot }) => slot)
    });
  }
}

function withTileRotation(
  ref: ResolvedTileRef,
  rotation: UVQuarterTurn
): ResolvedTileRef {
  const { rotation: _previous, ...rest } = ref;

  return rotation === 0 ?
    rest :
    {
      ...rest,
      rotation
    };
}

function rotatedRect(
  rect: SelectionRect,
  rotation: UVQuarterTurn
): UVRect {
  return rotation === 0 ?
    rect :
    {
      ...rect,
      rotation
    };
}

function recordOfFaces<TValue>(
  valueOf: (face: UVSlot) => TValue
): Record<UVSlot, TValue> {
  const record = {} as Record<UVSlot, TValue>;
  for (const face of DEFAULT_UV_SLOTS) {
    record[face] = valueOf(face);
  }

  return record;
}

function rectsEqual(
  left: SelectionRect,
  right: SelectionRect
): boolean {
  return left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length && left.every(
    (value, index) => value === right[index]
  );
}

function geometriesEqual(
  left: Record<string, UVGeometry> | undefined,
  right: Record<string, UVGeometry> | undefined
): boolean {
  const a = Object.entries(left ?? {});
  const b = Object.entries(right ?? {});

  return a.length === b.length && a.every(
    ([slot, geometry], index) => slot === b[index]?.[0] &&
      JSON.stringify(geometry) === JSON.stringify(b[index]?.[1])
  );
}
