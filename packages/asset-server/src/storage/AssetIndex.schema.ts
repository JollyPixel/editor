// Import Third-party Dependencies
import * as z from "zod/mini";

export const indexedAssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.string()
});

export const assetIndexSchema = z.object({
  assets: z.array(z.unknown())
});
