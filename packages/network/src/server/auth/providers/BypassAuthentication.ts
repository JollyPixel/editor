// Import Internal Dependencies
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "../AuthenticationProvider.ts";

export class BypassAuthentication implements AuthenticationProvider {
  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity {
    return {
      subject: request.clientId,
      role: request.defaultRole
    };
  }
}
