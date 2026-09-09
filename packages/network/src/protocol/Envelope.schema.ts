// Import Internal Dependencies
import { defineSchema } from "./schema.ts";

export const peerMetadataSchema = defineSchema({
  type: "object"
});

export const peerSchema = defineSchema({
  type: "object",
  properties: {
    clientId: { type: "string" },
    identity: peerMetadataSchema,
    presence: peerMetadataSchema
  },
  required: [
    "clientId",
    "identity",
    "presence"
  ]
});

export const joinEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "join" },
    identity: peerMetadataSchema
  },
  required: [
    "room",
    "kind"
  ]
});

export const leaveEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "leave" }
  },
  required: [
    "room",
    "kind"
  ]
});

export const messageEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "message" },
    payload: {}
  },
  required: [
    "room",
    "kind",
    "payload"
  ]
});

export const presenceEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "presence" },
    patch: peerMetadataSchema
  },
  required: [
    "room",
    "kind",
    "patch"
  ]
});

export const syncEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "sync" },
    members: {
      type: "array",
      items: peerSchema
    }
  },
  required: [
    "room",
    "kind",
    "members"
  ]
});

export const peerJoinedEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "peer-joined" },
    clientId: { type: "string" },
    identity: peerMetadataSchema
  },
  required: [
    "room",
    "kind",
    "clientId",
    "identity"
  ]
});

export const peerLeftEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "peer-left" },
    clientId: { type: "string" }
  },
  required: [
    "room",
    "kind",
    "clientId"
  ]
});

export const peerPresenceEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "peer-presence" },
    clientId: { type: "string" },
    patch: peerMetadataSchema
  },
  required: [
    "room",
    "kind",
    "clientId",
    "patch"
  ]
});

export const deniedEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "denied" },
    event: { type: "string" },
    reason: { type: "string" }
  },
  required: [
    "room",
    "kind",
    "event",
    "reason"
  ]
});

export const errorEnvelopeSchema = defineSchema({
  type: "object",
  properties: {
    room: { type: "string" },
    kind: { const: "error" },
    event: { type: "string" },
    reason: { type: "string" }
  },
  required: [
    "room",
    "kind",
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
    presenceEnvelopeSchema
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
    deniedEnvelopeSchema,
    errorEnvelopeSchema
  ]
});
