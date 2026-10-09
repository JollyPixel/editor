// Import Internal Dependencies
import { defineSchema } from "../schema.ts";

// CONSTANTS
const kMaxRoomNameLength = 256;

const kRoomProperties = {
  room: {
    type: "string",
    maxLength: kMaxRoomNameLength
  }
} as const;
const kRoomRequired = [
  "room",
  "kind"
] as const;
const kOutcomeProperties = {
  event: {
    type: "string"
  },
  reason: {
    type: "string"
  }
} as const;

export const rightSchema = defineSchema({
  enum: [
    "read",
    "write",
    "void"
  ]
});

export const peerMetadataSchema = defineSchema({
  type: "object"
});

export const roomRightsSchema = defineSchema({
  type: "object",
  additionalProperties: rightSchema
});

export const peerSchema = defineSchema({
  type: "object",
  properties: {
    clientId: {
      type: "string"
    },
    role: {
      type: "string"
    },
    profile: peerMetadataSchema,
    presence: peerMetadataSchema
  },
  required: [
    "clientId",
    "role",
    "profile",
    "presence"
  ]
});

export const joinEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "join"
    },
    profile: peerMetadataSchema,
    presence: peerMetadataSchema,
    resume: {}
  },
  required: kRoomRequired
});

export const leaveEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "leave"
    }
  },
  required: kRoomRequired
});

export const resyncEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "resync"
    }
  },
  required: kRoomRequired
});

export const messageEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "message"
    },
    payload: {}
  },
  required: [
    ...kRoomRequired,
    "payload"
  ]
});

export const presenceEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "presence"
    },
    patch: peerMetadataSchema
  },
  required: [
    ...kRoomRequired,
    "patch"
  ]
});

export const syncEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "sync"
    },
    self: {
      type: "string"
    },
    rights: roomRightsSchema,
    members: {
      type: "array",
      items: peerSchema
    }
  },
  required: [
    ...kRoomRequired,
    "self",
    "rights",
    "members"
  ]
});

export const peerJoinedEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "peer-joined"
    },
    ...peerSchema.properties
  },
  required: [
    ...kRoomRequired,
    ...peerSchema.required
  ]
});

export const peerLeftEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "peer-left"
    },
    clientId: {
      type: "string"
    }
  },
  required: [
    ...kRoomRequired,
    "clientId"
  ]
});

export const peerPresenceEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "peer-presence"
    },
    clientId: {
      type: "string"
    },
    patch: peerMetadataSchema
  },
  required: [
    ...kRoomRequired,
    "clientId",
    "patch"
  ]
});

export const peerProfileEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "peer-profile"
    },
    clientId: {
      type: "string"
    },
    patch: peerMetadataSchema
  },
  required: [
    ...kRoomRequired,
    "clientId",
    "patch"
  ]
});

export const deniedEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "denied"
    },
    ...kOutcomeProperties
  },
  required: [
    ...kRoomRequired,
    "event",
    "reason"
  ]
});

export const errorEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    ...kRoomProperties,
    kind: {
      const: "error"
    },
    ...kOutcomeProperties
  },
  required: [
    ...kRoomRequired,
    "event",
    "reason"
  ]
});

export const clientEnvelopeSchema = defineSchema({
  $id: "client-envelope",
  title: "ClientEnvelope",
  oneOf: [
    joinEnvelopeSchema,
    leaveEnvelopeSchema,
    messageEnvelopeSchema,
    presenceEnvelopeSchema,
    resyncEnvelopeSchema
  ]
});

export const serverEnvelopeSchema = defineSchema({
  $id: "server-envelope",
  title: "ServerEnvelope",
  oneOf: [
    messageEnvelopeSchema,
    syncEnvelopeSchema,
    peerJoinedEnvelopeSchema,
    peerLeftEnvelopeSchema,
    peerPresenceEnvelopeSchema,
    peerProfileEnvelopeSchema,
    deniedEnvelopeSchema,
    errorEnvelopeSchema
  ]
});
