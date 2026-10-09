// Import Third-party Dependencies
import {
  MaterialSurface,
  type MaterialSurfaceJSON
} from "@jolly-pixel/asset.voxel-model/client";

/**
 * A starting point for a new material; the material keeps no link to it.
 */
export interface MaterialPreset {
  id: string;
  label: string;
  surface: MaterialSurfaceJSON;
}

export const MATERIAL_PRESETS: readonly MaterialPreset[] = [
  {
    id: "default",
    label: "Material",
    surface: MaterialSurface.create()
  },
  {
    id: "glass",
    label: "Glass",
    surface: MaterialSurface.create({
      color: "#dff4ff",
      opacity: 0.45,
      roughness: 0.05
    })
  },
  {
    id: "ghost",
    label: "Ghost",
    surface: MaterialSurface.create({
      opacity: 0.2
    })
  },
  {
    id: "shadow",
    label: "Shadow",
    surface: MaterialSurface.create({
      color: "#555a66"
    })
  },
  {
    id: "metal",
    label: "Metal",
    surface: MaterialSurface.create({
      color: "#d0d4da",
      roughness: 0.3,
      metalness: 0.8
    })
  },
  {
    id: "glow",
    label: "Glow",
    surface: MaterialSurface.create({
      emissive: "#ffcc66",
      emissiveIntensity: 0.6
    })
  }
];
