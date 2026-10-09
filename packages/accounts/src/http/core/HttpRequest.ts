// Import Node.js Dependencies
import type {
  IncomingHttpHeaders,
  IncomingMessage
} from "node:http";
import {
  buffer,
  text
} from "node:stream/consumers";
import { TLSSocket } from "node:tls";

// Import Third-party Dependencies
import secureJson from "secure-json-parse";
import type * as z from "zod";

// Import Internal Dependencies
import { HttpError } from "./errors/HttpError.ts";
import type { TrustedProxies } from "./TrustedProxies.ts";

// CONSTANTS
const kMaxJsonBytes = 4 * 1_024;
const kJsonParseOptions: secureJson.ParseOptions = {
  protoAction: "error",
  constructorAction: "error"
};

export interface HttpRequestOptions {
  url: URL;
  params: Readonly<Record<string, string>>;
  proxies: TrustedProxies;
}

export class HttpRequest {
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;

  #message: IncomingMessage;
  #proxies: TrustedProxies;

  constructor(
    message: IncomingMessage,
    options: HttpRequestOptions
  ) {
    this.#message = message;
    this.url = options.url;
    this.params = options.params;
    this.#proxies = options.proxies;
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

  get headers(): IncomingHttpHeaders {
    return this.#message.headers;
  }

  async json<TSchema extends z.ZodType>(
    schema: TSchema
  ): Promise<z.output<TSchema>> {
    this.#expectLength(kMaxJsonBytes);

    let body: unknown;
    try {
      body = secureJson.parse(
        await text(this.#message),
        kJsonParseOptions
      );
    }
    catch {
      throw new HttpError(
        400,
        "invalid-request",
        "the request body is not safe JSON"
      );
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid-request",
        "the request body does not have the expected shape"
      );
    }

    return parsed.data;
  }

  async bytes(
    maxBytes: number
  ): Promise<Uint8Array> {
    this.#expectLength(maxBytes);

    return new Uint8Array(
      await buffer(this.#message)
    );
  }

  #expectLength(
    maxBytes: number
  ): void {
    const length = Number(
      this.#message.headers["content-length"] ?? Number.NaN
    );
    if (!Number.isInteger(length)) {
      throw new HttpError(
        411,
        "length-required",
        "the request body has no length"
      );
    }
    if (length > maxBytes) {
      throw new HttpError(
        413,
        "payload-too-large",
        "the request body is too large"
      );
    }
  }
}
