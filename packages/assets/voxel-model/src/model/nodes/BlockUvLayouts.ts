// Import Third-party Dependencies
import {
  UVRegion,
  type SelectionRect,
  type UVCompoundPart,
  type UVGeometry,
  type UVLayoutData,
  type UVSlot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BlockShapeJSON } from "../types.ts";
import { BlockShape } from "./BlockShape.ts";
import { TextureSpace } from "./TextureSpace.ts";

// CONSTANTS
const kBlockUvSize = 16;
const kLayoutIdentity = {
  id: "layout",
  color: "#000"
};
const kTriangleParts: readonly UVCompoundPart[] = [
  {
    shape: "triangle",
    rect: { x: 0, y: 0, width: 0.5, height: 1 },
    corner: "bottom-right"
  },
  {
    shape: "triangle",
    rect: { x: 0.5, y: 0, width: 0.5, height: 1 },
    corner: "bottom-left"
  }
];

export interface PlacedNet {
  uv: UVLayoutData;
  bounds: SelectionRect;
  /**
   * `true` when no free space was left, so the net overlaps another one.
   */
  shared: boolean;
}

export interface NetPlacement {
  /**
   * The texture size the nets were placed in, grown from the given one.
   */
  textureSize: Vec2;
  nets: PlacedNet[];
}

export class BlockUvLayouts {
  static readonly ORIGIN: Readonly<Vec2> = Object.freeze({ x: 0, y: 0 });

  static net(
    origin: Vec2 = BlockUvLayouts.ORIGIN,
    shape: BlockShapeJSON = BlockShape.box
  ): UVLayoutData {
    const rect = {
      x: origin.x,
      y: origin.y,
      width: kBlockUvSize,
      height: kBlockUvSize
    };
    const stacked: UVLayoutData = {
      state: "stacked",
      rect,
      faces: Object.fromEntries(
        BlockShape.slots(shape).map((slot) => [slot, cellGeometry(shape, slot, rect)])
      )
    };

    return BlockShape.isRound(shape) ?
      stacked :
      UVRegion.fromLayout(stacked, kLayoutIdentity).unfold().toLayout();
  }

  static #placeNets(
    shapes: readonly BlockShapeJSON[],
    space: TextureSpace
  ): PlacedNet[] {
    let free = space;

    return shapes.map((shape) => {
      const size = measureBounds(BlockUvLayouts.net(BlockUvLayouts.ORIGIN, shape));
      const origin = free.freeCell(size);
      const uv = BlockUvLayouts.net(origin ?? BlockUvLayouts.ORIGIN, shape);
      const bounds = measureBounds(uv);
      free = free.taking(bounds);

      return {
        uv,
        bounds,
        shared: origin === null
      };
    });
  }

  readonly #bounds: readonly SelectionRect[];

  constructor(
    layouts: Iterable<UVLayoutData>
  ) {
    this.#bounds = Array.from(layouts, measureBounds);
  }

  get extent(): Vec2 {
    const extent = {
      x: 0,
      y: 0
    };
    for (const bounds of this.#bounds) {
      extent.x = Math.max(extent.x, bounds.x + bounds.width);
      extent.y = Math.max(extent.y, bounds.y + bounds.height);
    }

    return extent;
  }

  nextNet(
    textureSize: Vec2,
    shape: BlockShapeJSON = BlockShape.box
  ): UVLayoutData {
    return BlockUvLayouts.net(this.#freeOrigin(textureSize, shape), shape);
  }

  place(
    shapes: readonly BlockShapeJSON[],
    textureSize: Vec2,
    maxTextureSize: number
  ): NetPlacement {
    let space = this.#space(textureSize);
    let nets = BlockUvLayouts.#placeNets(shapes, space);
    while (nets.some(({ shared }) => shared)) {
      const grown = space.grown();
      if (Math.max(grown.size.x, grown.size.y) > maxTextureSize) {
        break;
      }
      space = grown;
      nets = BlockUvLayouts.#placeNets(shapes, space);
    }

    return {
      textureSize: { ...space.size },
      nets
    };
  }

  reshaped(
    layout: UVLayoutData,
    from: BlockShapeJSON,
    to: BlockShapeJSON,
    textureSize: Vec2
  ): UVLayoutData {
    if (from.type !== to.type) {
      const net = BlockUvLayouts.net(measureBounds(layout), to);

      return this.#space(textureSize).isFree(measureBounds(net)) ? net : this.nextNet(textureSize, to);
    }

    return layout.state === "stacked" ?
      restacked(layout, to) :
      this.#unfoldedWithSides(layout, to, textureSize);
  }

  #unfoldedWithSides(
    layout: Exclude<UVLayoutData, { state: "stacked"; }>,
    shape: BlockShapeJSON,
    textureSize: Vec2
  ): UVLayoutData {
    const slots = BlockShape.slots(shape);
    const current = layout.faces;
    const kept = slots.filter((slot) => slot in current);
    const anchor = kept.findLast(BlockShape.isSideSlot) ?? kept[0];
    if (anchor === undefined) {
      return this.nextNet(textureSize, shape);
    }

    const cell = boundingRect(current[anchor]);
    let space = this.#space(textureSize).taking(...kept.map((slot) => boundingRect(current[slot])));
    const faces = Object.fromEntries(kept.map((slot) => [slot, current[slot]]));
    for (const slot of slots.filter((each) => !(each in current))) {
      const origin = space.freeCell(cell) ?? cell;
      const placed = { ...cell, x: origin.x, y: origin.y };
      faces[slot] = cellGeometry(shape, slot, placed);
      space = space.taking(placed);
    }

    return {
      ...layout,
      faces,
      ...filterActiveFaces(layout, slots)
    };
  }

  #freeOrigin(
    textureSize: Vec2,
    shape: BlockShapeJSON
  ): Vec2 {
    const net = measureBounds(BlockUvLayouts.net(BlockUvLayouts.ORIGIN, shape));

    return this.#space(textureSize).freeCell(net) ?? BlockUvLayouts.ORIGIN;
  }

  #space(
    textureSize: Vec2
  ): TextureSpace {
    return new TextureSpace(textureSize, this.#bounds);
  }
}

function restacked(
  layout: Extract<UVLayoutData, { state: "stacked"; }>,
  shape: BlockShapeJSON
): UVLayoutData {
  const slots = BlockShape.slots(shape);
  const { faces = {}, stackedFace, ...rest } = layout;

  return {
    ...rest,
    faces: Object.fromEntries(
      slots.map((slot) => [slot, faces[slot] ?? cellGeometry(shape, slot, layout.rect)])
    ),
    ...filterActiveFaces(layout, slots),
    ...stackedFace !== undefined && slots.includes(stackedFace) ? { stackedFace } : {}
  };
}

function filterActiveFaces(
  layout: UVLayoutData,
  slots: readonly UVSlot[]
): Pick<UVLayoutData, "activeFaces"> {
  if (layout.activeFaces === undefined) {
    return {};
  }

  const current = layout.faces ?? {};

  return {
    activeFaces: [
      ...layout.activeFaces.filter((slot) => slots.includes(slot)),
      ...slots.filter((slot) => !(slot in current))
    ]
  };
}

function cellGeometry(
  shape: BlockShapeJSON,
  slot: UVSlot,
  rect: SelectionRect
): UVGeometry {
  const { x, y, width, height } = rect;

  return BlockShape.isPointed(shape) && BlockShape.isSideSlot(slot) ?
    {
      shape: "compound",
      rect: { x, y, width, height },
      parts: kTriangleParts.map((part) => structuredClone(part))
    } :
    { x, y, width, height };
}

function boundingRect(
  geometry: UVGeometry
): SelectionRect {
  const { x, y, width, height } = "rect" in geometry ? geometry.rect : geometry;

  return { x, y, width, height };
}

function measureBounds(
  layout: UVLayoutData
): SelectionRect {
  return UVRegion.fromLayout(layout, kLayoutIdentity).bounds;
}
