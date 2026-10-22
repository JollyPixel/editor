// Import Third-party Dependencies
import * as z from "zod";
import { shareLinkSchema } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { SHARE_LIFETIMES } from "../ShareLifetime.ts";

// CONSTANTS
export const SHARES_URL_PATH = "/api/shares/";
export const VIEW_PAGES_PATH = "view/";
export const VIEW_PAGES_PREFIX = `/${VIEW_PAGES_PATH}`;

export const createShareBodySchema = z.object({
  assetId: z.string().min(1),
  lifetime: z.enum(SHARE_LIFETIMES)
});

export const createdShareReplySchema = z.object({
  link: shareLinkSchema
});

export const shareLinksReplySchema = z.object({
  links: z.array(shareLinkSchema),
  canShare: z.boolean()
});

export type CreateShareBody = z.infer<typeof createShareBodySchema>;
export type CreatedShareReply = z.infer<typeof createdShareReplySchema>;
export type ShareLinksReply = z.infer<typeof shareLinksReplySchema>;
