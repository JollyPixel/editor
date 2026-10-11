// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kHexColor = /^#[0-9a-f]{6}$/i;

export const MAX_LIGHT_LEVEL = 15;

export interface MaterialGroupJSON {
  id: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  normalScale?: number;
  lightLevel?: number;
  swatch?: string;
}

export type MaterialGroupFinish = Required<
  Omit<MaterialGroupJSON, "id" | "swatch">
>;

export type MaterialGroupChanges = Partial<Omit<MaterialGroupJSON, "id">>;

export type FinishableMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

export class MaterialGroup {
  static readonly defaults: Readonly<MaterialGroupFinish> = Object.freeze({
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 1,
    normalScale: 1,
    lightLevel: 0
  });

  readonly id: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: string;
  readonly emissiveIntensity: number;
  readonly normalScale: number;
  readonly lightLevel: number;
  readonly swatch: string | null;

  static parse(
    value: unknown
  ): MaterialGroup | null {
    return isMaterialGroupJSON(value) ? new MaterialGroup(value) : null;
  }

  constructor(
    json: MaterialGroupJSON
  ) {
    const problem = validateFields(json);
    if (problem !== null) {
      throw new RangeError(problem);
    }

    const { defaults } = MaterialGroup;
    this.id = json.id;
    this.roughness = json.roughness ?? defaults.roughness;
    this.metalness = json.metalness ?? defaults.metalness;
    this.emissive = (json.emissive ?? defaults.emissive).toLowerCase();
    this.emissiveIntensity = json.emissiveIntensity ??
      defaults.emissiveIntensity;
    this.normalScale = json.normalScale ?? defaults.normalScale;
    this.lightLevel = json.lightLevel ?? defaults.lightLevel;
    this.swatch = json.swatch?.toLowerCase() ?? null;
    Object.freeze(this);
  }

  get glows(): boolean {
    return this.emissive !== MaterialGroup.defaults.emissive &&
      this.emissiveIntensity > 0;
  }

  with(
    changes: MaterialGroupChanges
  ): MaterialGroup {
    return new MaterialGroup({
      ...this.toJSON(),
      ...changes,
      id: this.id
    });
  }

  applyMaterialFinish(
    material: FinishableMaterial
  ): void {
    material.emissive.set(this.emissive);
    material.emissiveIntensity = this.emissiveIntensity;
    material.normalScale.setScalar(this.normalScale);
    if (material instanceof THREE.MeshStandardMaterial) {
      material.roughness = this.roughness;
      material.metalness = this.metalness;
    }
  }

  equals(
    other: MaterialGroup
  ): boolean {
    return this.id === other.id &&
      this.roughness === other.roughness &&
      this.metalness === other.metalness &&
      this.emissive === other.emissive &&
      this.emissiveIntensity === other.emissiveIntensity &&
      this.normalScale === other.normalScale &&
      this.lightLevel === other.lightLevel &&
      this.swatch === other.swatch;
  }

  toJSON(): MaterialGroupJSON & MaterialGroupFinish {
    const json = {
      id: this.id,
      roughness: this.roughness,
      metalness: this.metalness,
      emissive: this.emissive,
      emissiveIntensity: this.emissiveIntensity,
      normalScale: this.normalScale,
      lightLevel: this.lightLevel
    };

    return this.swatch === null ?
      json :
      {
        ...json,
        swatch: this.swatch
      };
  }
}

function isMaterialGroupJSON(
  value: unknown
): value is MaterialGroupJSON {
  return validateFields(value) === null;
}

function validateFields(
  value: unknown
): string | null {
  if (typeof value !== "object" || value === null) {
    return "Material group must be an object.";
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const id = fields.get("id");
  const emissive = fields.get("emissive");
  const swatch = fields.get("swatch");

  if (typeof id !== "string" || id === "") {
    return "Material group id must be a non-empty string.";
  }
  if (!isUnitOrUndefined(fields.get("roughness"))) {
    return "Roughness must be between 0 and 1.";
  }
  if (!isUnitOrUndefined(fields.get("metalness"))) {
    return "Metalness must be between 0 and 1.";
  }
  if (
    emissive !== undefined &&
    (typeof emissive !== "string" || !kHexColor.test(emissive))
  ) {
    return "Emissive must be a #rrggbb colour.";
  }
  if (
    swatch !== undefined &&
    (typeof swatch !== "string" || !kHexColor.test(swatch))
  ) {
    return "Swatch must be a #rrggbb colour.";
  }
  if (!isNonNegativeOrUndefined(fields.get("emissiveIntensity"))) {
    return "Emissive intensity must be a finite number of 0 or more.";
  }
  if (!isNonNegativeOrUndefined(fields.get("normalScale"))) {
    return "Normal scale must be a finite number of 0 or more.";
  }
  if (!isLightLevelOrUndefined(fields.get("lightLevel"))) {
    return `Light level must be an integer between 0 and ${MAX_LIGHT_LEVEL}.`;
  }

  return null;
}

function isNonNegativeOrUndefined(
  value: unknown
): boolean {
  return value === undefined || (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isLightLevelOrUndefined(
  value: unknown
): boolean {
  return value === undefined || (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_LIGHT_LEVEL
  );
}

function isUnitOrUndefined(
  value: unknown
): boolean {
  return value === undefined || (
    typeof value === "number" &&
    value >= 0 &&
    value <= 1
  );
}
