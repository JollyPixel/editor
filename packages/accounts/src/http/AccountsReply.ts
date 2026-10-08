// Import Node.js Dependencies
import type { ServerResponse } from "node:http";

// Import Internal Dependencies
import type { AccountsRequestError } from "./errors/AccountsRequestError.ts";

// CONSTANTS
const kJsonContentType = "application/json; charset=utf-8";

export class AccountsReply {
  static json(
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
  ): AccountsReply {
    return new AccountsReply(
      status,
      JSON.stringify(body),
      {
        ...headers,
        "content-type": kJsonContentType
      }
    );
  }

  static empty(
    status: number,
    headers: Record<string, string> = {}
  ): AccountsReply {
    return new AccountsReply(
      status,
      undefined,
      headers
    );
  }

  static image(
    bytes: Uint8Array,
    contentType: string,
    cacheControl: string
  ): AccountsReply {
    return new AccountsReply(
      200,
      bytes,
      {
        "content-type": contentType,
        "cache-control": cacheControl,
        "cross-origin-resource-policy": "same-origin",
        "x-content-type-options": "nosniff"
      }
    );
  }

  static failure(
    error: AccountsRequestError,
    headers: Record<string, string> = {}
  ): AccountsReply {
    return AccountsReply.json(
      error.status,
      {
        code: error.code,
        message: error.message
      },
      headers
    );
  }

  readonly status: number;
  readonly body: string | Uint8Array | undefined;
  readonly headers: Readonly<Record<string, string>>;

  private constructor(
    status: number,
    body: string | Uint8Array | undefined,
    headers: Record<string, string>
  ) {
    this.status = status;
    this.body = body;
    this.headers = { ...headers };
  }

  send(
    response: ServerResponse
  ): void {
    response.statusCode = this.status;
    response.setHeader("cache-control", "no-store");
    for (const [name, value] of Object.entries(this.headers)) {
      response.setHeader(name, value);
    }
    response.end(this.body);
  }
}
