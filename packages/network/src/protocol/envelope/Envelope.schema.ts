// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
const kMaxRoomNameLength = 256;

const kRoom = z.string().check(z.maxLength(kMaxRoomNameLength));
const kOutcome = {
  event: z.string(),
  reason: z.string()
};

export const rightSchema = z.enum([
  "read",
  "write",
  "void"
]);

export const peerMetadataSchema = z.record(z.string(), z.unknown());

export const roomRightsSchema = z.record(z.string(), rightSchema);

const kPeerShape = {
  clientId: z.string(),
  role: z.string(),
  profile: peerMetadataSchema,
  presence: peerMetadataSchema
};

export const peerSchema = z.object(kPeerShape);

export const joinEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("join"),
  profile: z.optional(peerMetadataSchema),
  presence: z.optional(peerMetadataSchema),
  resume: z.optional(z.unknown())
});

export const leaveEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("leave")
});

export const resyncEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("resync")
});

export const messageEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("message"),
  payload: z.unknown()
});

export const presenceEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("presence"),
  patch: peerMetadataSchema
});

export const syncEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("sync"),
  self: z.string(),
  rights: roomRightsSchema,
  members: z.array(peerSchema)
});

export const peerJoinedEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("peer-joined"),
  ...kPeerShape
});

export const peerLeftEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("peer-left"),
  clientId: z.string()
});

export const peerPresenceEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("peer-presence"),
  clientId: z.string(),
  patch: peerMetadataSchema
});

export const peerProfileEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("peer-profile"),
  clientId: z.string(),
  patch: peerMetadataSchema
});

export const deniedEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("denied"),
  ...kOutcome
});

export const errorEnvelopeSchema = z.object({
  room: kRoom,
  kind: z.literal("error"),
  ...kOutcome
});

export const clientEnvelopeSchema = z.discriminatedUnion("kind", [
  joinEnvelopeSchema,
  leaveEnvelopeSchema,
  messageEnvelopeSchema,
  presenceEnvelopeSchema,
  resyncEnvelopeSchema
]);

export const serverEnvelopeSchema = z.discriminatedUnion("kind", [
  messageEnvelopeSchema,
  syncEnvelopeSchema,
  peerJoinedEnvelopeSchema,
  peerLeftEnvelopeSchema,
  peerPresenceEnvelopeSchema,
  peerProfileEnvelopeSchema,
  deniedEnvelopeSchema,
  errorEnvelopeSchema
]);
