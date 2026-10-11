// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const SHARE_LINK_VIA = "link";

export const shareLinkSchema = z.object({
  id: z.string(),
  token: z.string(),
  assetId: z.string(),
  createdBy: z.string(),
  createdAt: z.number(),
  expiresAt: z.number().nullable()
});

export type ShareLink = z.infer<typeof shareLinkSchema>;
