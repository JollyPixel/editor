// Import Internal Dependencies
import type { ModelMaterialJSON } from "../../network/types.ts";
import { MaterialSurface } from "./MaterialSurface.ts";

// CONSTANTS
export const MATERIAL_TRANSFER_KIND = "jolly-pixel/voxel-model-materials";

export type MaterialTransferJSON = Pick<ModelMaterialJSON, "name" | "surface">;

export function encodeMaterialTransfer(
  materials: Iterable<MaterialTransferJSON>
): string {
  return JSON.stringify({
    kind: MATERIAL_TRANSFER_KIND,
    materials: [...materials].map(({ name, surface }) => {
      return {
        name,
        surface
      };
    })
  });
}

export function decodeMaterialTransfer(
  text: string
): MaterialTransferJSON[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  }
  catch {
    return null;
  }

  if (
    !isRecord(parsed) ||
    parsed.kind !== MATERIAL_TRANSFER_KIND ||
    !Array.isArray(parsed.materials)
  ) {
    return null;
  }

  const materials: MaterialTransferJSON[] = [];
  for (const material of parsed.materials) {
    if (
      !isRecord(material) ||
      typeof material.name !== "string" ||
      !MaterialSurface.isValid(material.surface)
    ) {
      return null;
    }
    materials.push({
      name: material.name,
      surface: material.surface
    });
  }

  return materials;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
