// Import Internal Dependencies
import type { PeerMetadata } from "../../protocol/types.ts";

export interface PeerIdentity {
  subject: string;
  role: string;
  /**
   * Server-owned profile fields, merged over the client's on join.
   */
  profile?: PeerMetadata;
}

export interface AuthenticationAttempt {
  clientId: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  remoteAddress?: string;
  /**
   * Credential the client offered: the decoded auth subprotocol of a
   * WebSocket upgrade, or the `credential` of a loopback or channel socket.
   */
  credential?: string;
}

export interface AuthenticationRequest extends AuthenticationAttempt {
  defaultRole: string;
}

export type RoomAdmission = (
  identity: PeerIdentity,
  room: string
) => boolean | Promise<boolean>;

export interface AuthenticationProvider {
  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null | Promise<PeerIdentity | null>;

  watchRevocations?(
    listener: (subject: string) => void
  ): () => void;

  watchProfiles?(
    listener: (subject: string, patch: PeerMetadata) => void
  ): () => void;
}
