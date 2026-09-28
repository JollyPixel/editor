// CONSTANTS
const kAlignments: Record<OverlayPosition, OverlayAlignment> = {
  "top-left": ["start", "start"],
  "top-center": ["start", "center"],
  "top-right": ["start", "end"],
  "middle-left": ["center", "start"],
  center: ["center", "center"],
  "middle-right": ["center", "end"],
  "bottom-left": ["end", "start"],
  "bottom-center": ["end", "center"],
  "bottom-right": ["end", "end"]
};

export type OverlayPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface OverlayAnchor {
  top: string;
  right: string;
  bottom: string;
  left: string;
  transform: string;
}

export type AxisAlignment = "start" | "center" | "end";

export type OverlayAlignment = readonly [
  vertical: AxisAlignment,
  horizontal: AxisAlignment
];

export function resolveOverlayAlignment(
  position: OverlayPosition
): OverlayAlignment {
  return kAlignments[position];
}

export function resolveOverlayAnchor(
  position: OverlayPosition,
  inset: number
): OverlayAnchor {
  const [vertical, horizontal] = kAlignments[position];
  const offset = `${inset}px`;

  return {
    top: startOffset(vertical, offset),
    bottom: vertical === "end" ? offset : "",
    left: startOffset(horizontal, offset),
    right: horizontal === "end" ? offset : "",
    transform: centerTransform(horizontal, vertical)
  };
}

function startOffset(
  alignment: AxisAlignment,
  offset: string
): string {
  if (alignment === "start") {
    return offset;
  }

  return alignment === "center" ? "50%" : "";
}

function centerTransform(
  horizontal: AxisAlignment,
  vertical: AxisAlignment
): string {
  const x = horizontal === "center" ? "-50%" : "0";
  const y = vertical === "center" ? "-50%" : "0";
  if (x === "0" && y === "0") {
    return "";
  }

  return `translate(${x}, ${y})`;
}
