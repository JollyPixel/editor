// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";
import {
  buffer,
  json
} from "node:stream/consumers";
import { TLSSocket } from "node:tls";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { Username } from "../account/Username.ts";
import { PasswordDigest } from "../session/PasswordDigest.ts";
import type { SessionCookie } from "../session/SessionCookie.ts";
import { isCrossOrigin } from "../session/origin.ts";
import type { RegisterOptions } from "../registration/RegisterOptions.ts";
import { AccountsRequestError } from "./errors/AccountsRequestError.ts";
import type { TrustedProxies } from "./TrustedProxies.ts";

// CONSTANTS
const kMaxBodyBytes = 4 * 1_024;
const kCredentialsSchema = z.object({
  username: z.string(),
  password: z.string()
});
const kRegistrationSchema = kCredentialsSchema.extend({
  masterPassword: z.string().optional()
});

type CredentialsBody = z.output<typeof kCredentialsSchema>;

export interface Credentials {
  username: Username;
  password: PasswordDigest;
}

export interface Registration extends Credentials {
  options: RegisterOptions;
}

export class AccountsRequest {
  #message: IncomingMessage;
  #proxies: TrustedProxies;

  constructor(
    message: IncomingMessage,
    proxies: TrustedProxies
  ) {
    this.#message = message;
    this.#proxies = proxies;
  }

  get address(): string {
    return this.#proxies.clientAddress(
      this.#message.headers,
      this.#message.socket.remoteAddress
    );
  }

  get secure(): boolean {
    return this.#proxies.isSecure(
      this.#message.headers,
      this.#message.socket instanceof TLSSocket
    );
  }

  get crossOrigin(): boolean {
    return isCrossOrigin(this.#message.headers);
  }

  expect(
    method: "GET" | "POST" | "PUT"
  ): void {
    if (this.#message.method !== method) {
      throw new AccountsRequestError(
        405,
        "method-not-allowed",
        `expected ${method}`
      );
    }
  }

  query(
    name: string
  ): string | null {
    return URL.parse(
      this.#message.url ?? "",
      "http://localhost"
    )?.searchParams.get(name) ?? null;
  }

  sessionToken(
    cookie: SessionCookie
  ): string | null {
    return cookie.read(this.#message.headers);
  }

  async credentials(): Promise<Credentials> {
    return parseCredentials(
      await this.#credentialsBody(kCredentialsSchema)
    );
  }

  async registration(): Promise<Registration> {
    const body = await this.#credentialsBody(kRegistrationSchema);

    return {
      ...parseCredentials(body),
      options: {
        masterPassword: body.masterPassword
      }
    };
  }

  async #credentialsBody<TSchema extends z.ZodType<CredentialsBody>>(
    schema: TSchema
  ): Promise<z.output<TSchema>> {
    const body = schema.safeParse(
      await this.#json()
    );
    if (!body.success) {
      throw new AccountsRequestError(
        400,
        "invalid-request",
        "expected a username and a password"
      );
    }

    return body.data;
  }

  async bytes(
    maxBytes: number
  ): Promise<Uint8Array> {
    this.#expectLength(maxBytes);

    return new Uint8Array(
      await buffer(this.#message)
    );
  }

  async #json(): Promise<unknown> {
    this.#expectLength(kMaxBodyBytes);

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

  #expectLength(
    maxBytes: number
  ): void {
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
    if (length > maxBytes) {
      throw new AccountsRequestError(
        413,
        "payload-too-large",
        "the request body is too large"
      );
    }
  }
}

function parseCredentials(
  body: CredentialsBody
): Credentials {
  return {
    username: Username.parse(body.username),
    password: PasswordDigest.parse(body.password)
  };
}
