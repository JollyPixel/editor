// Import Internal Dependencies
import type {
  peerMetadataSchema,
  peerSchema,
  rightSchema,
  roomRightsSchema
} from "./envelope/Envelope.schema.ts";
import type { Infer } from "./schema.ts";

export type PeerMetadata = Infer<typeof peerMetadataSchema>;
export type Peer = Readonly<Infer<typeof peerSchema>>;
export type Right = Infer<typeof rightSchema>;
export type RoomRights = Readonly<Infer<typeof roomRightsSchema>>;
