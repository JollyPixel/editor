// Import Third-party Dependencies
import {
  resolvedBlockTextureSlots,
  tileRefForSlot,
  type BlockShape,
  type ResolvedBlockDefinition,
  type ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";
import {
  UV_FACES,
  UVRegion,
  type SelectionRect,
  type UVGeometry,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  blockShapeUv,
  uvGeometryForSlot,
  type BlockShapeUv,
  type UVSlotBounds
} from "./blockShapeUv.ts";

// CONSTANTS
const kRegionIdPrefix = "block-";
const kRegionColor = "#4488ff";
const kWholeTile: UVSlotBounds = {
  u0: 0,
  v0: 0,
  u1: 1,
  v1: 1
};
const kBoxShapeUv: BlockShapeUv = {
  activeFaces: [...UV_FACES],
  bounds: recordOfFaces(() => kWholeTile),
  triangles: {},
  parts: {},
  faceRanges: {},
  isBox: true
};

/**
 * Builds a complete UV-face record that `Object.fromEntries` cannot type.
 */
function recordOfFaces<TValue>(
  valueOf: (face: UVSlot) => TValue
): Record<UVSlot, TValue> {
  const record = {} as Record<UVSlot, TValue>;
  for (const face of UV_FACES) {
    record[face] = valueOf(face);
  }

  return record;
}

export function blockUvRegionId(
  blockId: number
): string {
  return `${kRegionIdPrefix}${blockId}`;
}

export function blockIdFromUvRegion(
  id: string
): number | null {
  if (!id.startsWith(kRegionIdPrefix)) {
    return null;
  }
  const value = Number(id.slice(kRegionIdPrefix.length));

  return Number.isNaN(value) ? null : value;
}

export function blockUsesTileset(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined,
  tilesetId: string
): boolean {
  return shape !== undefined && resolvedBlockTextureSlots(block, shape).some(
    ({ tile }) => tile.tilesetId === tilesetId
  );
}

export function blockUvRegion(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined,
  tileSize: number
): UVRegion {
  const shapeUv = shape === undefined ? kBoxShapeUv : blockShapeUv(shape);
  const hasFaceTextures = Object.keys(block.faceTextures ?? {}).length > 0;

  if (hasFaceTextures || !block.defaultTexture) {
    return uncollapsedBlockUvRegion(block, shape, tileSize, shapeUv);
  }

  if (shapeUv.isBox) {
    return new UVRegion({
      id: blockUvRegionId(block.id),
      color: kRegionColor,
      state: "collapsed",
      rect: rectOf(block.defaultTexture, tileSize)
    });
  }

  return uncollapsedBlockUvRegion(
    block,
    shape,
    tileSize,
    shapeUv
  ).collapse();
}

export function uncollapsedBlockUvRegion(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined,
  tileSize: number,
  shapeUv: BlockShapeUv = shape === undefined ?
    kBoxShapeUv :
    blockShapeUv(shape)
): UVRegion {
  const textureSlots = shape === undefined ?
    [] :
    resolvedBlockTextureSlots(block, shape);
  const faces = Object.fromEntries(
    textureSlots.map(({ slot, tile }): [UVSlot, UVGeometry] => {
      const rect = rectOf(tile, tileSize, shapeUv.bounds[slot]);

      return [slot, uvGeometryForSlot(rect, shapeUv, slot)];
    })
  ) as Record<UVSlot, UVGeometry>;

  return new UVRegion({
    id: blockUvRegionId(block.id),
    color: kRegionColor,
    state: "uncollapsed",
    faces,
    activeFaces: textureSlots.map(({ slot }) => slot)
  });
}

export function blockFromUvRegion(
  block: ResolvedBlockDefinition,
  shape: BlockShape | undefined,
  region: UVRegion,
  tileSize: number
): ResolvedBlockDefinition {
  const shapeUv = shape === undefined ? kBoxShapeUv : blockShapeUv(shape);
  const collapsedSlot = region.collapsedFace ??
    shapeUv.activeFaces[0] ??
    "front";

  if (region.state === "uncollapsed") {
    return {
      ...block,
      faceTextures: Object.fromEntries(
        region.faces.map((face) => {
          const template = tileRefForSlot(block, face);
          if (!template) {
            throw new RangeError(`No texture template for UV slot "${face}"`);
          }

          return [
            face,
            tileRefOf(
              region.rectFor(face),
              template,
              tileSize,
              shapeUv.bounds[face]
            )
          ];
        })
      )
    };
  }

  const template = tileRefForSlot(block, collapsedSlot);
  if (!template) {
    throw new RangeError(
      `No texture template for UV slot "${collapsedSlot}"`
    );
  }

  return {
    ...block,
    faceTextures: {},
    defaultTexture: tileRefOf(
      region.rectFor(collapsedSlot),
      template,
      tileSize,
      shapeUv.bounds[collapsedSlot]
    )
  };
}

export function uvRegionsEqual(
  left: UVRegion,
  right: UVRegion
): boolean {
  const a = left.toJSON();
  const b = right.toJSON();
  if (
    a.state !== b.state ||
    a.name !== b.name ||
    a.color !== b.color ||
    left.collapsedFace !== right.collapsedFace
  ) {
    return false;
  }
  if (a.state === "collapsed" && b.state === "collapsed") {
    return rectsEqual(a.rect, b.rect) && geometriesEqual(a.faces, b.faces);
  }
  if (a.state === "uncollapsed" && b.state === "uncollapsed") {
    return arraysEqual(a.activeFaces ?? [], b.activeFaces ?? []) &&
      geometriesEqual(a.faces, b.faces);
  }

  return false;
}

function rectOf(
  tileRef: ResolvedTileRef,
  tileSize: number,
  bounds: UVSlotBounds = kWholeTile
): SelectionRect {
  return {
    x: (tileRef.col + bounds.u0) * tileSize,
    y: (tileRef.row + (1 - bounds.v1)) * tileSize,
    width: (bounds.u1 - bounds.u0) * tileSize,
    height: (bounds.v1 - bounds.v0) * tileSize
  };
}

function tileRefOf(
  rect: SelectionRect,
  template: ResolvedTileRef,
  tileSize: number,
  bounds: UVSlotBounds = kWholeTile
): ResolvedTileRef {
  return {
    ...template,
    col: (rect.x / tileSize) - bounds.u0,
    row: (rect.y / tileSize) - (1 - bounds.v1)
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
