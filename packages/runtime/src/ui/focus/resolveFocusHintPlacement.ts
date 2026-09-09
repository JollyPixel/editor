export type FocusHintPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface FocusHintRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocusHintSize {
  width: number;
  height: number;
}

export interface FocusHintPlacement {
  x: number;
  y: number;
}

type AxisAlignment = "start" | "center" | "end";

export function resolveFocusHintPlacement(
  position: FocusHintPosition,
  canvas: FocusHintRect,
  hint: FocusHintSize,
  inset: number
): FocusHintPlacement {
  return {
    x: resolveAxis(
      horizontalAlignment(position),
      canvas.x,
      canvas.width,
      hint.width,
      inset
    ),
    y: resolveAxis(
      verticalAlignment(position),
      canvas.y,
      canvas.height,
      hint.height,
      inset
    )
  };
}

function resolveAxis(
  alignment: AxisAlignment,
  origin: number,
  available: number,
  size: number,
  inset: number
): number {
  if (alignment === "center") {
    return origin + Math.max(inset, (available - size) / 2);
  }
  if (alignment === "end") {
    return origin + Math.max(inset, available - size - inset);
  }

  return origin + inset;
}

function verticalAlignment(
  position: FocusHintPosition
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
  position: FocusHintPosition
): AxisAlignment {
  if (position.endsWith("left")) {
    return "start";
  }
  if (position.endsWith("right")) {
    return "end";
  }

  return "center";
}
