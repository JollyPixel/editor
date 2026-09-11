// Import Internal Dependencies
import { readCredential } from "../credentials.ts";
import {
  hashPassword,
  verifyPassword,
  type PasswordHash
} from "../password.ts";
import type {
  AuthenticationProvider,
  AuthenticationRequest,
  PeerIdentity
} from "../AuthenticationProvider.ts";

export interface PasswordAuthenticationOptions {
  password: string;
  role: string;
  mandatory?: boolean;
}

export class PasswordAuthentication implements AuthenticationProvider {
  #passwordHash: Promise<PasswordHash>;
  #role: string;
  #mandatory: boolean;

  constructor(
    options: PasswordAuthenticationOptions
  ) {
    this.#passwordHash = hashPassword(
      options.password
    );
    this.#role = options.role;
    this.#mandatory = options.mandatory ?? false;
  }

  async authenticate(
    request: AuthenticationRequest
  ): Promise<PeerIdentity | null> {
    const credential = readCredential(request);
    if (credential === null) {
      if (this.#mandatory) {
        return null;
      }

      return {
        subject: request.clientId,
        role: request.defaultRole
      };
    }

    const passwordHash = await this.#passwordHash;
    const isPasswordValid = await verifyPassword(
      credential,
      passwordHash
    );
    if (!isPasswordValid) {
      return null;
    }

    return {
      subject: request.clientId,
      role: this.#role
    };
  }
}
