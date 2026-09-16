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

type AxisAlignment = "start" | "center" | "end";

export function resolveOverlayAnchor(
  position: OverlayPosition,
  inset: number
): OverlayAnchor {
  const vertical = verticalAlignment(position);
  const horizontal = horizontalAlignment(position);
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

function verticalAlignment(
  position: OverlayPosition
): AxisAlignment {
  if (position.startsWith("top")) {
    return "start";
  }
  if (position.startsWith("bottom")) {
    return "end";
  }

  return "center";
}

function horizontalAlignment(
  position: OverlayPosition
): AxisAlignment {
  if (position.endsWith("left")) {
    return "start";
  }
  if (position.endsWith("right")) {
    return "end";
  }

  return "center";
}
