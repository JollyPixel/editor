// Import Internal Dependencies
import type {
  peerMetadataSchema,
  peerSchema,
  rightSchema,
  roomRightsSchema
} from "./Envelope.schema.ts";
import type { Infer } from "./schema.ts";

export interface ClientHandle {
  readonly id: string;
  send(
    data: unknown
  ): void;
}

export type PeerMetadata = Infer<typeof peerMetadataSchema>;
export type Peer = Readonly<Infer<typeof peerSchema>>;
export type Right = Infer<typeof rightSchema>;
export type RoomRights = Readonly<Infer<typeof roomRightsSchema>>;
