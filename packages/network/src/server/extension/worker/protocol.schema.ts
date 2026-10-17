// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { peerMetadataSchema } from "../../../protocol/envelope/Envelope.schema.ts";

// CONSTANTS
const kIdentifier = z.string();
const kIdentity = z.object({
  subject: kIdentifier,
  role: kIdentifier
});
const kRoomPeer = z.object({
  clientId: kIdentifier,
  identity: kIdentity,
  profile: peerMetadataSchema,
  presence: peerMetadataSchema,
  resume: z.optional(z.unknown())
});

function dispatchVariant<
  const TMethod extends string,
  TArgs extends z.ZodMiniTuple
>(
  method: TMethod,
  args: TArgs
) {
  return z.object({
    type: z.literal("dispatch"),
    id: kIdentifier,
    identity: kIdentity,
    method: z.literal(method),
    args
  });
}

function contextCallVariant<
  const TMethod extends string,
  TArgs extends z.ZodMiniTuple
>(
  method: TMethod,
  args: TArgs
) {
  return z.object({
    type: z.literal("context-call"),
    method: z.literal(method),
    args
  });
}

export const hostWorkerDataSchema = z.object({
  id: kIdentifier,
  modulePath: kIdentifier,
  exportName: z.optional(kIdentifier),
  extensionWorkerData: z.optional(z.unknown())
});

export const mainToWorkerSchema = z.union([
  dispatchVariant("onClientConnect", z.tuple([kIdentifier, kRoomPeer])),
  dispatchVariant("onClientDisconnect", z.tuple([kIdentifier])),
  dispatchVariant("onResync", z.tuple([kIdentifier])),
  dispatchVariant("onMessage", z.tuple([kIdentifier, z.unknown()]))
]);

export const workerToMainSchema = z.union([
  z.object({
    type: z.literal("ready"),
    methods: z.array(z.enum([
      "onClientConnect",
      "onClientDisconnect",
      "onResync",
      "onMessage"
    ]))
  }),
  z.object({
    type: z.literal("dispatch-result"),
    id: kIdentifier,
    ok: z.boolean(),
    error: z.optional(kIdentifier)
  }),
  contextCallVariant("room.broadcast", z.tuple([z.unknown()])),
  contextCallVariant("client.send", z.tuple([kIdentifier, z.unknown()]))
]);
