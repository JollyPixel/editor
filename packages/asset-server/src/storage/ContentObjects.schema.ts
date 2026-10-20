// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
const kBackupShape = {
  hash: z.string(),
  size: z.int().check(z.minimum(0)),
  assetId: z.string(),
  path: z.string(),
  createdAt: z.string()
};

export const backupEntrySchema = z.discriminatedUnion("reason", [
  z.object({
    ...kBackupShape,
    reason: z.literal("tag"),
    tag: z.object({
      name: z.string(),
      message: z.optional(z.string())
    })
  }),
  z.object({
    ...kBackupShape,
    reason: z.literal("external-edit")
  })
]);

export const backupLedgerSchema = z.object({
  entries: z.array(z.unknown())
});
