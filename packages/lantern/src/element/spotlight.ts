// Import Third-party Dependencies
import type {
  AnchorRect,
  ViewportSize
} from "@jolly-pixel/ui";

export type CornerRadii = readonly [
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number
];

export const SQUARE_CORNERS: CornerRadii = [0, 0, 0, 0];

export interface Hole {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: CornerRadii;
}

export function holeAround(
  rect: AnchorRect,
  radii: CornerRadii,
  viewport: ViewportSize,
  padding: number
): Hole {
  if (reachesEdge(rect, viewport, padding)) {
    return {
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
      radii
    };
  }

  const [topLeft, topRight, bottomRight, bottomLeft] = radii;

  return {
    x: rect.left - padding,
    y: rect.top - padding,
    width: rect.right - rect.left + (padding * 2),
    height: rect.bottom - rect.top + (padding * 2),
    radii: [
      topLeft + padding,
      topRight + padding,
      bottomRight + padding,
      bottomLeft + padding
    ]
  };
}

export function holeAtCentre(
  viewport: ViewportSize
): Hole {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2,
    width: 0,
    height: 0,
    radii: SQUARE_CORNERS
  };
}

export function spotlightPath(
  hole: Hole,
  viewport: ViewportSize
): string {
  const { x, y, width, height } = hole;
  const limit = Math.min(width, height) / 2;
  const [tl, tr, br, bl] = hole.radii.map(
    (radius) => Math.min(radius, limit)
  );
  const outer = `M0 0H${viewport.width}V${viewport.height}H0Z`;
  const inner = [
    `M${x + tl} ${y}`,
    `H${x + width - tr}`,
    `A${tr} ${tr} 0 0 1 ${x + width} ${y + tr}`,
    `V${y + height - br}`,
    `A${br} ${br} 0 0 1 ${x + width - br} ${y + height}`,
    `H${x + bl}`,
    `A${bl} ${bl} 0 0 1 ${x} ${y + height - bl}`,
    `V${y + tl}`,
    `A${tl} ${tl} 0 0 1 ${x + tl} ${y}`,
    "Z"
  ].join("");

  return `path(evenodd, "${outer}${inner}")`;
}

export function borderRadius(
  radii: CornerRadii
): string {
  return radii.map((radius) => `${radius}px`).join(" ");
}

function reachesEdge(
  rect: AnchorRect,
  viewport: ViewportSize,
  padding: number
): boolean {
  return rect.left < padding ||
    rect.top < padding ||
    rect.right > viewport.width - padding ||
    rect.bottom > viewport.height - padding;
}
