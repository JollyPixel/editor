// Import Internal Dependencies
import type {
  RGBA,
  Vec2
} from "../types.ts";

export interface ColorGroup {
  color: RGBA;
  positions: Vec2[];
}

/**
 * Groups positions by RGBA color.
 */
export function groupPositionsByColor(
  positions: Vec2[],
  colors: RGBA[]
): ColorGroup[] {
  const groups = new Map<string, ColorGroup>();

  for (let i = 0; i < positions.length; i++) {
    const color = colors[i];
    const key = `${color.r},${color.g},${color.b},${color.a}`;

    let group = groups.get(key);
    if (!group) {
      group = { color, positions: [] };
      groups.set(key, group);
    }
    group.positions.push(positions[i]);
  }

  return [...groups.values()];
}

