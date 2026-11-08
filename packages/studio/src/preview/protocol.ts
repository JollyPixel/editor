// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const PREVIEW_TARGET = "asset-preview";
export const PREVIEW_REQUESTS = "jolly-preview-requests";
export const PREVIEW_IMAGE_TYPE = "image/png";

const kRequestsSchema = z.object({
  type: z.literal(PREVIEW_REQUESTS),
  port: z.instanceof(MessagePort)
});
const kRequestSchema = z.object({
  id: z.number(),
  assetId: z.string(),
  size: z.number()
});
const kReplySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rendered"),
    id: z.number(),
    bytes: z.instanceof(Uint8Array)
  }),
  z.object({
    type: z.literal("failed"),
    id: z.number(),
    reason: z.string()
  })
]);

export type PreviewRequests = z.output<typeof kRequestsSchema>;
export type PreviewRequest = z.output<typeof kRequestSchema>;
export type PreviewReply = z.output<typeof kReplySchema>;

export function parsePreviewRequests(
  data: unknown
): PreviewRequests | undefined {
  const parsed = kRequestsSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function parsePreviewRequest(
  data: unknown
): PreviewRequest | undefined {
  const parsed = kRequestSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function parsePreviewReply(
  data: unknown
): PreviewReply | undefined {
  const parsed = kReplySchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
