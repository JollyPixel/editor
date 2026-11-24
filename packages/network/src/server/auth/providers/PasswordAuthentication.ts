// Import Third-party Dependencies
import { Mutex } from "@openally/mutex";

// Import Internal Dependencies
import {
  hashPassword,
  verifyPassword,
  type PasswordHash
} from "../password.ts";
import { FailedAttempts } from "../throttling/FailedAttempts.ts";
import { addressBlock } from "../throttling/addressBlock.ts";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "../AuthenticationProvider.ts";

// CONSTANTS
const kDefaultMaxFailures = 10;
const kDefaultFailureWindowMs = 60_000;
const kDefaultMaxConcurrentChecks = 2;

export interface PasswordAuthenticationOptions {
  password: string;
  role: string;
  mandatory?: boolean;
  /**
   * Wrong passwords a client may offer within `failureWindowMs`.
   * Past it, the client is refused without a password check.
   * @default 10
   */
  maxFailures?: number;
  /**
   * Names the client whose failures are counted together. Behind a reverse
   * proxy, return the forwarded client address.
   * @default the remote address, its /64 block for IPv6, one shared key
   * without an address
   */
  clientKey?: (request: AuthenticationRequest) => string;
  /**
   * @default 60_000
   */
  failureWindowMs?: number;
  /**
   * Password checks running at once. Attempts past it wait their turn,
   * which keeps libuv threads free for file I/O.
   * @default 2
   */
  maxConcurrentChecks?: number;
}

export class PasswordAuthentication implements AuthenticationProvider {
  #passwordHash: Promise<PasswordHash>;
  #role: string;
  #mandatory: boolean;
  #failures: FailedAttempts;
  #clientKey: (request: AuthenticationRequest) => string;
  #checks: Mutex;

  constructor(
    options: PasswordAuthenticationOptions
  ) {
    this.#passwordHash = hashPassword(
      options.password
    );
    this.#role = options.role;
    this.#mandatory = options.mandatory ?? false;
    this.#failures = new FailedAttempts({
      limit: options.maxFailures ?? kDefaultMaxFailures,
      windowMs: options.failureWindowMs ?? kDefaultFailureWindowMs
    });
    this.#clientKey = options.clientKey ??
      ((request) => addressBlock(request.remoteAddress));
    this.#checks = new Mutex({
      concurrency: options.maxConcurrentChecks ?? kDefaultMaxConcurrentChecks
    });
  }

  async authenticate(
    request: AuthenticationRequest
  ): Promise<PeerIdentity | null> {
    const { credential } = request;
    if (credential === undefined) {
      if (this.#mandatory) {
        return null;
      }

      return {
        subject: request.clientId,
        role: request.defaultRole
      };
    }

    const isPasswordValid = await this.#checkFrom(
      this.#clientKey(request),
      credential
    );
    if (!isPasswordValid) {
      return null;
    }

    return {
      subject: request.clientId,
      role: this.#role
    };
  }

  async #checkFrom(
    client: string,
    credential: string
  ): Promise<boolean> {
    if (this.#failures.blocks(client)) {
      return false;
    }

    this.#failures.record(client);
    const isPasswordValid = await this.#check(credential);
    if (isPasswordValid) {
      this.#failures.forgive(client);
    }

    return isPasswordValid;
  }

  async #check(
    credential: string
  ): Promise<boolean> {
    using _ = await this.#checks.acquire();

    return await verifyPassword(
      credential,
      await this.#passwordHash
    );
  }
}
