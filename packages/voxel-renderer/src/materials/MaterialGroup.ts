// Import Third-party Dependencies
import * as THREE from "three";

// CONSTANTS
const kHexColor = /^#[0-9a-f]{6}$/i;

export interface MaterialGroupJSON {
  id: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export type MaterialGroupFinish = Required<Omit<MaterialGroupJSON, "id">>;

export type FinishableMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

export class MaterialGroup {
  static readonly defaults: Readonly<MaterialGroupFinish> = Object.freeze({
    roughness: 1,
    metalness: 0,
    emissive: "#000000",
    emissiveIntensity: 1
  });

  readonly id: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly emissive: string;
  readonly emissiveIntensity: number;

  static parse(
    value: unknown
  ): MaterialGroup | null {
    return isMaterialGroupJSON(value) ? new MaterialGroup(value) : null;
  }

  constructor(
    json: MaterialGroupJSON
  ) {
    const problem = problemOf(json);
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
    Object.freeze(this);
  }

  with(
    finish: Partial<MaterialGroupFinish>
  ): MaterialGroup {
    return new MaterialGroup({
      ...this.toJSON(),
      ...finish,
      id: this.id
    });
  }

  applyTo(
    material: FinishableMaterial
  ): void {
    material.emissive.set(this.emissive);
    material.emissiveIntensity = this.emissiveIntensity;
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
      this.emissiveIntensity === other.emissiveIntensity;
  }

  toJSON(): Required<MaterialGroupJSON> {
    return {
      id: this.id,
      roughness: this.roughness,
      metalness: this.metalness,
      emissive: this.emissive,
      emissiveIntensity: this.emissiveIntensity
    };
  }
}

function isMaterialGroupJSON(
  value: unknown
): value is MaterialGroupJSON {
  return problemOf(value) === null;
}

function problemOf(
  value: unknown
): string | null {
  if (typeof value !== "object" || value === null) {
    return "Material group must be an object.";
  }

  const fields: Map<string, unknown> = new Map(Object.entries(value));
  const id = fields.get("id");
  const emissive = fields.get("emissive");
  const emissiveIntensity = fields.get("emissiveIntensity");

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
    emissiveIntensity !== undefined &&
    (
      typeof emissiveIntensity !== "number" ||
      !Number.isFinite(emissiveIntensity) ||
      emissiveIntensity < 0
    )
  ) {
    return "Emissive intensity must be a finite number of 0 or more.";
  }

  return null;
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
