// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";
import { json } from "node:stream/consumers";
import { TLSSocket } from "node:tls";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { Username } from "../account/Username.ts";
import { PasswordDigest } from "../session/PasswordDigest.ts";
import type { SessionCookie } from "../session/SessionCookie.ts";
import { isCrossOrigin } from "../session/origin.ts";
import { AccountsRequestError } from "./errors/AccountsRequestError.ts";

// CONSTANTS
const kMaxBodyBytes = 4 * 1_024;
const kCredentialsSchema = z.object({
  username: z.string(),
  password: z.string()
});

export interface Credentials {
  username: Username;
  password: PasswordDigest;
}

export class AccountsRequest {
  #message: IncomingMessage;

  constructor(
    message: IncomingMessage
  ) {
    this.#message = message;
  }

  get address(): string {
    return this.#message.socket.remoteAddress ?? "unknown";
  }

  get secure(): boolean {
    return this.#message.socket instanceof TLSSocket;
  }

  get crossOrigin(): boolean {
    return isCrossOrigin(this.#message.headers);
  }

  expect(
    method: "GET" | "POST"
  ): void {
    if (this.#message.method !== method) {
      throw new AccountsRequestError(
        405,
        "method-not-allowed",
        `expected ${method}`
      );
    }
  }

  sessionToken(
    cookie: SessionCookie
  ): string | null {
    return cookie.read(this.#message.headers);
  }

  async credentials(): Promise<Credentials> {
    const body = kCredentialsSchema.safeParse(
      await this.#json()
    );
    if (!body.success) {
      throw new AccountsRequestError(
        400,
        "invalid-request",
        "expected a username and a password"
      );
    }

    return {
      username: Username.parse(body.data.username),
      password: PasswordDigest.parse(body.data.password)
    };
  }

  async #json(): Promise<unknown> {
    const length = Number(
      this.#message.headers["content-length"] ?? Number.NaN
    );
    if (!Number.isInteger(length)) {
      throw new AccountsRequestError(
        411,
        "length-required",
        "the request body has no length"
      );
    }
    if (length > kMaxBodyBytes) {
      throw new AccountsRequestError(
        413,
        "payload-too-large",
        "the request body is too large"
      );
    }

    try {
      return await json(this.#message);
    }
    catch {
      throw new AccountsRequestError(
        400,
        "invalid-request",
        "the request body is not JSON"
      );
    }
  }
}
