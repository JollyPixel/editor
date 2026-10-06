// Import Third-party Dependencies
import type { VoxelObjectProperties } from "@jolly-pixel/voxel.renderer";

export interface PropertyRow {
  key: string;
  value: string;
}

export interface PropertyRowsChangeDetail {
  rows: PropertyRow[];
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
