// CONSTANTS
const kMaxEdgeWidth = 8;
const kMinDashSize = 0.02;

export type BrushEdgeStyle = "solid" | "dashed";

export interface BrushStyle {
  opacity: number;
  /**
   * Width of the footprint edges, in CSS pixels.
   */
  edgeWidth: number;
  edgeStyle: BrushEdgeStyle;
  /**
   * Length of a dash, in world units. Ignored while the edges are solid.
   */
  dashSize: number;
  /**
   * Length of the gap between two dashes, in world units. Ignored while the
   * edges are solid.
   */
  gapSize: number;
}

export const DEFAULT_BRUSH_STYLE: BrushStyle = Object.freeze({
  opacity: 0.15,
  edgeWidth: 2,
  edgeStyle: "solid",
  dashSize: 0.2,
  gapSize: 0.1
});

export function brushStyleFrom(
  patch: Partial<BrushStyle> | null | undefined,
  base: BrushStyle = DEFAULT_BRUSH_STYLE
): BrushStyle {
  if (!patch) {
    return base;
  }

  return Object.freeze({
    opacity: clamp(patch.opacity, base.opacity, 0, 1),
    edgeWidth: clamp(patch.edgeWidth, base.edgeWidth, 0, kMaxEdgeWidth),
    edgeStyle: patch.edgeStyle === "solid" || patch.edgeStyle === "dashed"
      ? patch.edgeStyle
      : base.edgeStyle,
    dashSize: clamp(patch.dashSize, base.dashSize, kMinDashSize, 1),
    gapSize: clamp(patch.gapSize, base.gapSize, kMinDashSize, 1)
  });
}

export function readBrushStyle(
  value: unknown
): BrushStyle {
  if (typeof value !== "object" || value === null) {
    return DEFAULT_BRUSH_STYLE;
  }

  return brushStyleFrom({
    opacity: numberOf(Reflect.get(value, "opacity")),
    edgeWidth: numberOf(Reflect.get(value, "edgeWidth")),
    edgeStyle: Reflect.get(value, "edgeStyle") as BrushEdgeStyle,
    dashSize: numberOf(Reflect.get(value, "dashSize")),
    gapSize: numberOf(Reflect.get(value, "gapSize"))
  });
}

export function brushStyleEquals(
  a: BrushStyle,
  b: BrushStyle
): boolean {
  return a.opacity === b.opacity &&
    a.edgeWidth === b.edgeWidth &&
    a.edgeStyle === b.edgeStyle &&
    a.dashSize === b.dashSize &&
    a.gapSize === b.gapSize;
}

function numberOf(
  value: unknown
): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function clamp(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}
