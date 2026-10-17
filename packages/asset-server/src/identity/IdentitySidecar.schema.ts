// Import Third-party Dependencies
import * as z from "zod/mini";

export const identityEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.string()
});

export const identitySidecarSchema = z.object({
  assets: z.array(z.unknown())
});
