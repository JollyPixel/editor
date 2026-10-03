// Import Third-party Dependencies
import {
  BlockTextures,
  tileRectOf,
  tileRefFromRect,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import {
  UVRegion,
  rotationOf,
  type SelectionRect,
  type UVGeometry,
  type UVQuarterTurn,
  type UVRect,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";
import { BlockProjection } from "@jolly-pixel/asset.voxel-map/client";

// CONSTANTS
const kRegionColor = "#4488ff";

export class BlockUv extends BlockProjection {
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

  region(): UVRegion {
    const { block } = this;
    const hasFaceTextures = Object.keys(block.faceTextures ?? {}).length > 0;
    if (hasFaceTextures || !block.defaultTexture) {
      return this.freeRegion();
    }

    if (this.isBox) {
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

    return this.#freeRegion(this.stackedFaces()).stack();
  }

  freeRegion(): UVRegion {
    return this.#freeRegion(this.faces());
  }

  apply(
    region: UVRegion
  ): ResolvedBlockDefinition {
    const { block, tileSize, shapeUv } = this;
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
    faces: Record<UVSlot, UVGeometry>
  ): UVRegion {
    return new UVRegion({
      id: this.regionId,
      name: this.block.name,
      color: kRegionColor,
      state: "free",
      faces,
      activeFaces: this.layout.slots.map(({ slot }) => slot)
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
