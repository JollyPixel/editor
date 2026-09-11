export interface PeerIdentity {
  subject: string;
  role: string;
}

export interface AuthenticationAttempt {
  clientId: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface AuthenticationRequest extends AuthenticationAttempt {
  defaultRole: string;
}

export interface AuthenticationProvider {
  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null | Promise<PeerIdentity | null>;
}
