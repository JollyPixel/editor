// Import Third-party Dependencies
import {
  type AuthenticationProvider,
  type AuthenticationRequest,
  type PeerIdentity
} from "@jolly-pixel/network";
import { encodeBase64Url } from "@jolly-pixel/utils";

// CONSTANTS
const kTokenBytes = 32;
const kSubjectPrefix = "peer-invite:";

export class PeerInvites implements AuthenticationProvider {
  readonly #issued = new Map<string, string>();

  get size(): number {
    return this.#issued.size;
  }

  issue(): string {
    const token = encodeBase64Url(
      crypto.getRandomValues(new Uint8Array(kTokenBytes))
    );
    this.#issued.set(token, kSubjectPrefix + crypto.randomUUID());

    return token;
  }

  clear(): void {
    this.#issued.clear();
  }

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null {
    const { credential } = request;
    if (credential === undefined) {
      return {
        subject: request.clientId,
        role: request.defaultRole
      };
    }

    const subject = this.#issued.get(credential);

    return subject === undefined ? null : {
      subject,
      role: request.defaultRole
    };
  }
}
