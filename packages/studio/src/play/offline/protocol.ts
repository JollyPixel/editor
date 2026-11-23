// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const PLAY_REQUEST = "jolly-play-request";
export const PLAY_ACCEPTED = "jolly-play-accepted";
export const PLAY_RESPONSE = "jolly-play-response";
export const OFFLINE_PARAM = "offline";
export const PLAY_ROOT = "http://play.invalid/";
export const PLAY_TIMEOUT_MS = 5_000;
export const PLAY_HEARTBEAT_MS = 1_000;
const kChannelPrefix = "jolly-play:";

const kPlayRequestSchema = z.object({
  type: z.literal(PLAY_REQUEST),
  id: z.string(),
  path: z.string()
});

const kPlayReplySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(PLAY_ACCEPTED),
    id: z.string()
  }),
  z.object({
    type: z.literal(PLAY_RESPONSE),
    id: z.string(),
    status: z.number(),
    contentType: z.string(),
    cacheControl: z.string(),
    body: z.custom<Uint8Array>((value) => value instanceof Uint8Array)
  })
]);

export type PlayRequest = z.output<typeof kPlayRequestSchema>;
export type PlayReply = z.output<typeof kPlayReplySchema>;
export type PlayResponse = Omit<
  Extract<PlayReply, { type: typeof PLAY_RESPONSE; }>,
  "type" | "id"
>;

export function playChannelName(
  offline: string
): string {
  return `${kChannelPrefix}${offline}`;
}

export function parsePlayRequest(
  data: unknown
): PlayRequest | undefined {
  const parsed = kPlayRequestSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function parsePlayReply(
  data: unknown
): PlayReply | undefined {
  const parsed = kPlayReplySchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}
