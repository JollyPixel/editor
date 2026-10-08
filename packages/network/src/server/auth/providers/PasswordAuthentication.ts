// Import Third-party Dependencies
import { Mutex } from "@openally/mutex";

// Import Internal Dependencies
import { readCredential } from "../credentials.ts";
import {
  hashPassword,
  verifyPassword,
  type PasswordHash
} from "../password.ts";
import { FailedAttempts } from "../throttling/FailedAttempts.ts";
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
   * Wrong passwords a remote address may offer within `failureWindowMs`.
   * Past it, the address is refused without a password check.
   * @default 10
   */
  maxFailures?: number;
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
    this.#checks = new Mutex({
      concurrency: options.maxConcurrentChecks ?? kDefaultMaxConcurrentChecks
    });
  }

  async authenticate(
    request: AuthenticationRequest
  ): Promise<PeerIdentity | null> {
    let credential: string | null;
    try {
      credential = readCredential(request);
    }
    catch {
      return null;
    }

    if (credential === null) {
      if (this.#mandatory) {
        return null;
      }

      return {
        subject: request.clientId,
        role: request.defaultRole
      };
    }

    const { remoteAddress } = request;
    const isPasswordValid = remoteAddress === undefined ?
      await this.#check(credential) :
      await this.#checkFrom(remoteAddress, credential);
    if (!isPasswordValid) {
      return null;
    }

    return {
      subject: request.clientId,
      role: this.#role
    };
  }

  async #checkFrom(
    address: string,
    credential: string
  ): Promise<boolean> {
    if (this.#failures.blocks(address)) {
      return false;
    }

    this.#failures.record(address);
    const isPasswordValid = await this.#check(credential);
    if (isPasswordValid) {
      this.#failures.forgive(address);
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
