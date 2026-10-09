// Import Internal Dependencies
import type {
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON
} from "../../network/types.ts";

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
const kSurfaceKeys = [
  "color",
  "opacity",
  "roughness",
  "metalness",
  "emissive",
  "emissiveIntensity"
] as const;
const kSurfaceProperties = {
  color: kHexColorSchema,
  opacity: kUnitSchema,
  roughness: kUnitSchema,
  metalness: kUnitSchema,
  emissive: kHexColorSchema,
  emissiveIntensity: {
    type: "number",
    minimum: 0
  }
} as const satisfies Record<(typeof kSurfaceKeys)[number], SurfaceFieldSchema>;
const kDefaultSurface: MaterialSurfaceJSON = {
  color: "#ffffff",
  opacity: 1,
  roughness: 1,
  metalness: 0,
  emissive: "#000000",
  emissiveIntensity: 1
};
const kFieldRules = new Map<string, (value: unknown) => boolean>(
  kSurfaceKeys.map((key) => [key, fieldRule(kSurfaceProperties[key])])
);

export class MaterialSurface {
  static readonly KEYS = kSurfaceKeys;
  static readonly PROPERTIES = kSurfaceProperties;

  static create(
    overrides: Partial<MaterialSurfaceJSON> = {}
  ): MaterialSurfaceJSON {
    return {
      ...kDefaultSurface,
      ...overrides
    };
  }

  static isValid(
    value: unknown
  ): value is MaterialSurfaceJSON {
    return typeof value === "object" && value !== null &&
      kSurfaceKeys.every((key) => satisfiesField(key, Reflect.get(value, key)));
  }

  static isPatch(
    value: unknown
  ): value is MaterialSurfacePatchJSON {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const keys = Object.keys(value);

    return keys.length > 0 &&
      keys.every((key) => satisfiesField(key, Reflect.get(value, key)));
  }

  readonly #surface: MaterialSurfaceJSON;

  constructor(
    surface: MaterialSurfaceJSON
  ) {
    if (!MaterialSurface.isValid(surface)) {
      throw new RangeError(`Invalid material surface: ${JSON.stringify(surface)}`);
    }

    this.#surface = { ...surface };
  }

  changesTo(
    next: MaterialSurfaceJSON
  ): MaterialSurfacePatchJSON {
    const changes: MaterialSurfacePatchJSON = {};
    for (const key of kSurfaceKeys) {
      if (this.#surface[key] !== next[key]) {
        Object.assign(changes, { [key]: next[key] });
      }
    }

    return changes;
  }

  holds(
    patch: MaterialSurfacePatchJSON
  ): boolean {
    return kSurfaceKeys.every(
      (key) => patch[key] === undefined || patch[key] === this.#surface[key]
    );
  }

  toJSON(): MaterialSurfaceJSON {
    return { ...this.#surface };
  }
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
