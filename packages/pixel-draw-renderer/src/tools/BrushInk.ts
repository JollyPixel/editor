// Import Internal Dependencies
import type { RGBA8 } from "../types.ts";

// CONSTANTS
const kOpaque = 255;

export type BrushInkName = "blend" | "replace" | "lock-alpha";

type InkOver = (color: RGBA8, under: RGBA8) => RGBA8;

export class BrushInk {
  static readonly blend = new BrushInk("blend", (color, under) => {
    if (color.a === kOpaque || color.a === 0) {
      return { ...color };
    }

    const sourceAlpha = color.a / kOpaque;
    const underAlpha = (under.a / kOpaque) * (1 - sourceAlpha);

    return {
      ...mixRgb(color, under, sourceAlpha, underAlpha),
      a: Math.round((sourceAlpha + underAlpha) * kOpaque)
    };
  });

  static readonly replace = new BrushInk("replace", (color) => {
    return { ...color };
  });

  static readonly lockAlpha = new BrushInk("lock-alpha", (color, under) => {
    if (under.a === 0) {
      return { ...under };
    }

    const amount = color.a / kOpaque;

    return {
      ...mixRgb(color, under, amount, 1 - amount),
      a: under.a
    };
  });

  static named(
    name: BrushInkName
  ): BrushInk {
    switch (name) {
      case "blend":
        return BrushInk.blend;
      case "replace":
        return BrushInk.replace;
      case "lock-alpha":
        return BrushInk.lockAlpha;
      default:
        throw new RangeError(`Unknown brush ink '${String(name)}'`);
    }
  }

  readonly name: BrushInkName;
  readonly over: InkOver;

  private constructor(
    name: BrushInkName,
    over: InkOver
  ) {
    this.name = name;
    this.over = over;
  }
}

function mixRgb(
  color: RGBA8,
  under: RGBA8,
  colorWeight: number,
  underWeight: number
): Omit<RGBA8, "a"> {
  const total = colorWeight + underWeight;

  return {
    r: Math.round(((color.r * colorWeight) + (under.r * underWeight)) / total),
    g: Math.round(((color.g * colorWeight) + (under.g * underWeight)) / total),
    b: Math.round(((color.b * colorWeight) + (under.b * underWeight)) / total)
  };
}
