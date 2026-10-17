// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { BLOCKSET_DOCUMENT_VERSION } from "./blockset.ts";
import { tileSizeSchema } from "../network/schema.ts";
import { materialGroupSchema } from "../network/blockset/BlocksetCommand.schema.ts";

export const blocksetDocumentSchema = z.object({
  version: z.literal(BLOCKSET_DOCUMENT_VERSION),
  tileSize: tileSizeSchema,
  pixels: z.record(z.string(), z.unknown()),
  blocks: z.array(z.unknown()),
  materialGroups: z.array(materialGroupSchema)
});
