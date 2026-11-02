// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  ComponentData,
  toHexColor
} from "../../../systems/scene/file/definitions/ComponentData.ts";
import type { JSONObject } from "../../../systems/scene/file/SceneFile.ts";

export interface MeshMaterialOptions {
  /**
   * @default "#ffffff"
   */
  color?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  roughness?: number;
  /**
   * @default 0
   */
  metalness?: number;
  /**
   * @default "#000000"
   */
  emissive?: THREE.ColorRepresentation;
  /**
   * @default 1
   */
  emissiveIntensity?: number;
  /**
   * Below 1 the material renders as transparent.
   * @default 1
   */
  opacity?: number;
  /**
   * @default false
   */
  flatShading?: boolean;
}

export type MeshMaterialSettings = Required<MeshMaterialOptions>;

export interface MeshSurfaceOptions {
  material?: MeshMaterialOptions;
  /**
   * @default false
   */
  castShadow?: boolean;
  /**
   * @default false
   */
  receiveShadow?: boolean;
}

export interface MeshSurfaceSettings {
  material: MeshMaterialSettings;
  castShadow: boolean;
  receiveShadow: boolean;
}

interface MeshSurfaceData {
  material: JSONObject;
  castShadow: boolean;
  receiveShadow: boolean;
}

// CONSTANTS
export const MESH_SURFACE_DEFAULTS = {
  material: {
    color: "#ffffff",
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 1,
    opacity: 1,
    flatShading: false
  },
  castShadow: false,
  receiveShadow: false
} as const satisfies MeshSurfaceSettings;

export function mergeMeshSurface(
  settings: MeshSurfaceSettings,
  options: MeshSurfaceOptions
): MeshSurfaceSettings {
  return {
    material: {
      ...settings.material,
      ...options.material
    },
    castShadow: options.castShadow ?? settings.castShadow,
    receiveShadow: options.receiveShadow ?? settings.receiveShadow
  };
}

export function parseMeshSurface(
  fields: ComponentData
): MeshSurfaceSettings {
  const defaults = MESH_SURFACE_DEFAULTS;
  const material = fields.object("material") ?? new ComponentData({});

  return {
    material: {
      color: material.color("color", defaults.material.color),
      roughness: material.number("roughness", defaults.material.roughness),
      metalness: material.number("metalness", defaults.material.metalness),
      emissive: material.color("emissive", defaults.material.emissive),
      emissiveIntensity: material.number(
        "emissiveIntensity",
        defaults.material.emissiveIntensity
      ),
      opacity: material.number("opacity", defaults.material.opacity),
      flatShading: material.boolean("flatShading", defaults.material.flatShading)
    },
    castShadow: fields.boolean("castShadow", defaults.castShadow),
    receiveShadow: fields.boolean("receiveShadow", defaults.receiveShadow)
  };
}

export function captureMeshSurface(
  settings: MeshSurfaceSettings
): MeshSurfaceData {
  const { material, castShadow, receiveShadow } = settings;

  return {
    material: {
      ...material,
      color: toHexColor(material.color),
      emissive: toHexColor(material.emissive)
    },
    castShadow,
    receiveShadow
  };
}
