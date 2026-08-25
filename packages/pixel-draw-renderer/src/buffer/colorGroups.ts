// Import Internal Dependencies
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type {
  DefaultPixelBuffer
} from "./types.ts";

export interface ColorGroup {
  color: RGBA8;
  positions: Vec2[];
}

interface ColorGroupBuffer extends DefaultPixelBuffer {
  drawColorGroups(
    groups: Iterable<ColorGroup>
  ): void;
}

function supportsColorGroups(
  buffer: DefaultPixelBuffer
): buffer is ColorGroupBuffer {
  return "drawColorGroups" in buffer &&
    typeof buffer.drawColorGroups === "function";
}

function isByte(
  value: number
): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 255;
}

function colorKey(
  color: RGBA8
): number | string {
  const { r, g, b, a } = color;
  if (
    isByte(r) &&
    isByte(g) &&
    isByte(b) &&
    isByte(a)
  ) {
    return (((r * 256) + g) * 256 + b) * 256 + a;
  }

  return `${r},${g},${b},${a}`;
}

export function groupPositionsByColor(
  positions: Vec2[],
  colors: RGBA8[]
): ColorGroup[] {
  const groups = new Map<number | string, ColorGroup>();

  for (let i = 0; i < positions.length; i++) {
    const color = colors[i];
    const key = colorKey(color);

    let group = groups.get(key);
    if (!group) {
      group = { color, positions: [] };
      groups.set(key, group);
    }
    group.positions.push(positions[i]);
  }

  return [
    ...groups.values()
  ];
}

export function applyColorGroups(
  buffer: DefaultPixelBuffer,
  groups: ColorGroup[]
): void {
  if (supportsColorGroups(buffer)) {
    buffer.drawColorGroups(groups);

    return;
  }

  for (const group of groups) {
    buffer.drawPixels(
      group.positions,
      group.color
    );
  }
}
