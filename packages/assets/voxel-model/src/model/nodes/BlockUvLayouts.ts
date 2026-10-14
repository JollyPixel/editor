// Import Third-party Dependencies
import {
  RectArea,
  UVRegion,
  type SelectionRect,
  type UVCompoundPart,
  type UVGeometry,
  type UVLayoutData,
  type UVSlot,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BlockShapeJSON } from "../../network/types.ts";
import { BlockShape } from "./BlockShape.ts";

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
        BlockShape.slots(shape).map((slot) => [slot, cellOf(shape, slot, rect)])
      )
    };

    return BlockShape.isRound(shape) ?
      stacked :
      UVRegion.fromLayout(stacked, kLayoutIdentity).unfold().toLayout();
  }

  readonly #bounds: readonly SelectionRect[];

  constructor(
    layouts: Iterable<UVLayoutData>
  ) {
    this.#bounds = Array.from(layouts, boundsOf);
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

  reshaped(
    layout: UVLayoutData,
    from: BlockShapeJSON,
    to: BlockShapeJSON,
    textureSize: Vec2
  ): UVLayoutData {
    if (from.type !== to.type) {
      const net = BlockUvLayouts.net(boundsOf(layout), to);

      return isFree(boundsOf(net), textureSize, this.#bounds) ? net : this.nextNet(textureSize, to);
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

    const cell = rectOf(current[anchor]);
    const taken = [...this.#bounds, ...kept.map((slot) => rectOf(current[slot]))];
    const faces = Object.fromEntries(kept.map((slot) => [slot, current[slot]]));
    for (const slot of slots.filter((each) => !(each in current))) {
      const origin = freeCell(cell, textureSize, taken) ?? cell;
      const placed = { ...cell, x: origin.x, y: origin.y };
      faces[slot] = cellOf(shape, slot, placed);
      taken.push(placed);
    }

    return {
      ...layout,
      faces,
      ...activeFacesFor(layout, slots)
    };
  }

  #freeOrigin(
    textureSize: Vec2,
    shape: BlockShapeJSON
  ): Vec2 {
    const net = boundsOf(BlockUvLayouts.net(BlockUvLayouts.ORIGIN, shape));

    return freeCell(net, textureSize, this.#bounds) ?? BlockUvLayouts.ORIGIN;
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
      slots.map((slot) => [slot, faces[slot] ?? cellOf(shape, slot, layout.rect)])
    ),
    ...activeFacesFor(layout, slots),
    ...stackedFace !== undefined && slots.includes(stackedFace) ? { stackedFace } : {}
  };
}

function activeFacesFor(
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

function freeCell(
  size: Pick<SelectionRect, "width" | "height">,
  textureSize: Vec2,
  taken: readonly SelectionRect[]
): Vec2 | null {
  const columns = Math.floor(textureSize.x / size.width);
  const rows = Math.floor(textureSize.y / size.height);

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cell = {
        x: column * size.width,
        y: row * size.height,
        width: size.width,
        height: size.height
      };
      if (isFree(cell, textureSize, taken)) {
        return {
          x: cell.x,
          y: cell.y
        };
      }
    }
  }

  return null;
}

function isFree(
  rect: SelectionRect,
  textureSize: Vec2,
  taken: readonly SelectionRect[]
): boolean {
  return rect.x + rect.width <= textureSize.x &&
    rect.y + rect.height <= textureSize.y &&
    !taken.some((bounds) => RectArea.from(bounds).intersects(rect));
}

function cellOf(
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

function rectOf(
  geometry: UVGeometry
): SelectionRect {
  const { x, y, width, height } = "rect" in geometry ? geometry.rect : geometry;

  return { x, y, width, height };
}

function boundsOf(
  layout: UVLayoutData
): SelectionRect {
  return UVRegion.fromLayout(layout, kLayoutIdentity).bounds;
}
