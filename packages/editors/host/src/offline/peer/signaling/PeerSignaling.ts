// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
const kPeerSignalSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("offer"),
    sdp: z.string()
  }),
  z.object({
    type: z.literal("answer"),
    sdp: z.string()
  }),
  z.object({
    type: z.literal("candidate"),
    candidate: z.string(),
    sdpMid: z.nullable(z.string()),
    sdpMLineIndex: z.nullable(z.number()),
    usernameFragment: z.optional(z.nullable(z.string()))
  })
]);

const kPeerSignalMessageSchema = z.object({
  from: z.string(),
  to: z.string(),
  session: z.string(),
  signal: kPeerSignalSchema
});

export type PeerSignal = z.infer<typeof kPeerSignalSchema>;
export type PeerSignalMessage = z.infer<typeof kPeerSignalMessageSchema>;
export type OutgoingPeerSignal = Omit<PeerSignalMessage, "from">;
export type PeerSignalListener = (message: PeerSignalMessage) => void;

export interface PeerSignaling {
  readonly id: string;

  send(
    message: OutgoingPeerSignal
  ): void;

  subscribe(
    listener: PeerSignalListener
  ): () => void;

  close(): void;
}

export function parsePeerSignalMessage(
  value: unknown
): PeerSignalMessage | undefined {
  const result = kPeerSignalMessageSchema.safeParse(value);

  return result.success ? result.data : undefined;
}
