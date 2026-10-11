// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import type { PeerMetadata } from "../types.ts";

// CONSTANTS
export const GUEST_USERNAME = "Guest";

const kSameOriginPathSchema = z.string().check(
  z.refine((value) => value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\"))
);

const kPeerProfileSchema = z.readonly(z.object({
  username: z.catch(z.string(), GUEST_USERNAME),
  peerId: z.catch(z.optional(z.string()), undefined),
  avatar: z.catch(z.optional(kSameOriginPathSchema), undefined),
  via: z.catch(z.optional(z.string()), undefined)
}));

export type PeerProfile = z.infer<typeof kPeerProfileSchema>;

export type PeerProfileMetadata = {
  username: string;
  peerId?: string;
  avatar?: string | null;
  via?: string;
};

export function parsePeerProfile(
  metadata: PeerMetadata | undefined
): PeerProfile {
  return kPeerProfileSchema.parse(metadata ?? {});
}
