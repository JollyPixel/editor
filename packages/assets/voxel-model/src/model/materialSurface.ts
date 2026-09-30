// Import Internal Dependencies
import type {
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON
} from "../network/types.ts";

type SurfaceFieldSchema =
  | { readonly type: "string"; readonly pattern: string; }
  | { readonly type: "number"; readonly minimum: number; readonly maximum?: number; };

// CONSTANTS
const kHexColorSchema = {
  type: "string",
  pattern: "^#[0-9a-f]{6}$"
} as const;
const kUnitSchema = {
  type: "number",
  minimum: 0,
  maximum: 1
} as const;

export const MATERIAL_SURFACE_KEYS = [
  "color",
  "opacity",
  "roughness",
  "metalness",
  "emissive",
  "emissiveIntensity"
] as const;

export const MATERIAL_SURFACE_PROPERTIES = {
  color: kHexColorSchema,
  opacity: kUnitSchema,
  roughness: kUnitSchema,
  metalness: kUnitSchema,
  emissive: kHexColorSchema,
  emissiveIntensity: {
    type: "number",
    minimum: 0
  }
} as const satisfies Record<(typeof MATERIAL_SURFACE_KEYS)[number], SurfaceFieldSchema>;

const kSurfaceKeys: readonly (keyof MaterialSurfaceJSON)[] = MATERIAL_SURFACE_KEYS;
const kFieldRules = new Map<string, (value: unknown) => boolean>(
  kSurfaceKeys.map((key) => [key, fieldRule(MATERIAL_SURFACE_PROPERTIES[key])])
);

export function createMaterialSurface(
  overrides: Partial<MaterialSurfaceJSON> = {}
): MaterialSurfaceJSON {
  return {
    color: "#ffffff",
    opacity: 1,
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 1,
    ...overrides
  };
}

export function materialSurfaceChanges(
  current: MaterialSurfaceJSON,
  next: MaterialSurfaceJSON
): MaterialSurfacePatchJSON {
  const changes: MaterialSurfacePatchJSON = {};
  for (const key of kSurfaceKeys) {
    if (current[key] !== next[key]) {
      Object.assign(changes, { [key]: next[key] });
    }
  }

  return changes;
}

export function holdsSurfacePatch(
  surface: MaterialSurfaceJSON,
  patch: MaterialSurfacePatchJSON
): boolean {
  return kSurfaceKeys.every(
    (key) => patch[key] === undefined || patch[key] === surface[key]
  );
}

export function isMaterialSurface(
  value: unknown
): value is MaterialSurfaceJSON {
  return typeof value === "object" && value !== null &&
    kSurfaceKeys.every((key) => satisfiesField(key, Reflect.get(value, key)));
}

export function isMaterialSurfacePatch(
  value: unknown
): value is MaterialSurfacePatchJSON {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.length > 0 &&
    keys.every((key) => satisfiesField(key, Reflect.get(value, key)));
}

function satisfiesField(
  key: string,
  value: unknown
): boolean {
  return kFieldRules.get(key)?.(value) ?? false;
}

function fieldRule(
  schema: SurfaceFieldSchema
): (value: unknown) => boolean {
  if (schema.type === "string") {
    const pattern = new RegExp(schema.pattern);

    return (value) => typeof value === "string" && pattern.test(value);
  }

  const { minimum, maximum = Infinity } = schema;

  return (value) => typeof value === "number" &&
    value >= minimum &&
    value <= maximum;
}
