// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { PeerMetadata } from "../types.ts";

// CONSTANTS
export const PEER_ACTIVITY_KEY = "activity";
export const PEER_ACTIVITY_LABEL_MAX_LENGTH = 200;

export const peerActivitySchema = z.strictObject({
  label: z.string().check(
    z.minLength(1),
    z.maxLength(PEER_ACTIVITY_LABEL_MAX_LENGTH)
  ),
  progress: z.optional(z.number().check(
    z.minimum(0),
    z.maximum(1)
  ))
});

export type PeerActivity = z.infer<typeof peerActivitySchema>;

export function parsePeerActivity(
  presence: PeerMetadata | undefined
): PeerActivity | null {
  const parsed = peerActivitySchema.safeParse(presence?.[PEER_ACTIVITY_KEY]);

  return parsed.success ? parsed.data : null;
}
