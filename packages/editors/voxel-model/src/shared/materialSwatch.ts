// Import Third-party Dependencies
import type {
  MaterialSurfaceJSON,
  ModelMaterialJSON
} from "@jolly-pixel/asset.voxel-model/client";
import type { TreeSwatch } from "@jolly-pixel/ui";

// CONSTANTS
const kNoEmissive = "#000000";

export function materialSwatch(
  material: Pick<ModelMaterialJSON, "name" | "surface"> | null
): TreeSwatch {
  if (material === null) {
    return { title: "Add material" };
  }

  return {
    title: `Material: ${material.name}`,
    ...surfaceSwatch(material.surface)
  };
}

export function surfaceSwatch(
  surface: MaterialSurfaceJSON
): { color: string; ring?: string; } {
  return {
    color: withAlpha(surface.color, surface.opacity),
    ...(surfaceGlows(surface) ? { ring: surface.emissive } : {})
  };
}

export function surfaceGlows(
  surface: MaterialSurfaceJSON
): boolean {
  return surface.emissive !== kNoEmissive && surface.emissiveIntensity > 0;
}

function withAlpha(
  hex: string,
  opacity: number
): string {
  if (opacity >= 1) {
    return hex;
  }

  const alpha = Math.round(opacity * 255).toString(16).padStart(2, "0");

  return `${hex}${alpha}`;
}
