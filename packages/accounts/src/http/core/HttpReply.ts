// Import Node.js Dependencies
import type { ServerResponse } from "node:http";

// Import Internal Dependencies
import type { HttpError } from "./errors/HttpError.ts";

// CONSTANTS
const kJsonContentType = "application/json; charset=utf-8";

export class HttpReply {
  static json(
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
  ): HttpReply {
    return new HttpReply(
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
  ): HttpReply {
    return new HttpReply(
      status,
      undefined,
      headers
    );
  }

  static bytes(
    body: Uint8Array,
    headers: Record<string, string>
  ): HttpReply {
    return new HttpReply(
      200,
      body,
      {
        ...headers,
        "x-content-type-options": "nosniff"
      }
    );
  }

  static failure(
    error: HttpError
  ): HttpReply {
    return HttpReply.json(
      error.status,
      {
        code: error.code,
        message: error.message
      },
      error.headers
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
