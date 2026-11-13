// Import Third-party Dependencies
import { minProperties } from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import type {
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON
} from "../types.ts";

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
const kNoEmissive = "#000000";
const kDefaultSurface: MaterialSurfaceJSON = {
  color: "#ffffff",
  opacity: 1,
  roughness: 1,
  metalness: 0,
  emissive: kNoEmissive,
  emissiveIntensity: 1
};
const kHexColorField = z.string().check(
  z.regex(new RegExp(kHexColorSchema.pattern))
);
const kUnitField = z.number().check(
  z.minimum(kUnitSchema.minimum),
  z.maximum(kUnitSchema.maximum)
);
const kSurfaceShape = {
  color: kHexColorField,
  opacity: kUnitField,
  roughness: kUnitField,
  metalness: kUnitField,
  emissive: kHexColorField,
  emissiveIntensity: z.number().check(
    z.minimum(kSurfaceProperties.emissiveIntensity.minimum)
  )
} satisfies Record<(typeof kSurfaceKeys)[number], z.ZodMiniType>;

export const materialSurfaceSchema = z.object(kSurfaceShape);

export const materialSurfacePatchSchema = minProperties(
  z.partial(z.strictObject(kSurfaceShape)),
  1
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

  static parse(
    value: unknown
  ): MaterialSurfaceJSON | undefined {
    const result = materialSurfaceSchema.safeParse(value);

    return result.success ? result.data : undefined;
  }

  static parsePatch(
    value: unknown
  ): MaterialSurfacePatchJSON | undefined {
    const result = materialSurfacePatchSchema.safeParse(value);

    return result.success ? result.data : undefined;
  }

  static glows(
    surface: MaterialSurfaceJSON
  ): boolean {
    return surface.emissive !== kNoEmissive && surface.emissiveIntensity > 0;
  }

  readonly #surface: MaterialSurfaceJSON;

  constructor(
    surface: MaterialSurfaceJSON
  ) {
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
