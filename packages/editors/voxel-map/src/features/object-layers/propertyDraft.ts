// Import Third-party Dependencies
import type { VoxelObjectProperties } from "@jolly-pixel/voxel.renderer";

/**
 * One editable row of the custom properties table.
 *
 * Rows are addressed by index rather than by key: a key is free to be blank
 * or duplicated while it is being typed, which re-keying a record on every
 * keystroke cannot represent.
 */
export interface PropertyRow {
  key: string;
  value: string;
}

export function propertyRowsOf(
  properties: VoxelObjectProperties | undefined
): PropertyRow[] {
  return Object.entries(properties ?? {}).map(
    ([key, value]) => {
      return { key, value: String(value) };
    }
  );
}

/**
 * Folds the rows back into a record. Blank keys are dropped, and a later
 * row wins over an earlier one holding the same key.
 */
export function propertiesOf(
  rows: readonly PropertyRow[]
): VoxelObjectProperties {
  const properties: VoxelObjectProperties = {};
  for (const { key, value } of rows) {
    const trimmed = key.trim();
    if (trimmed) {
      properties[trimmed] = value;
    }
  }

  return properties;
}
