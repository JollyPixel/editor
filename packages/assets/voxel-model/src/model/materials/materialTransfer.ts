// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { ModelMaterialJSON } from "../types.ts";
import { materialSurfaceSchema } from "./MaterialSurface.ts";

// CONSTANTS
export const MATERIAL_TRANSFER_KIND = "jolly-pixel/voxel-model-materials";

const kMaterialTransferSchema = z.object({
  kind: z.literal(MATERIAL_TRANSFER_KIND),
  materials: z.array(z.object({
    name: z.string(),
    surface: materialSurfaceSchema
  }))
});

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
  const result = kMaterialTransferSchema.safeParse(parsed);

  return result.success ? result.data.materials : null;
}
