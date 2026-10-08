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
}

export interface AuthenticationRequest extends AuthenticationAttempt {
  defaultRole: string;
}

export interface AuthenticationProvider {
  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null | Promise<PeerIdentity | null>;
}
