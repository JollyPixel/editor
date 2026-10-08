// Import Node.js Dependencies
import type { ServerResponse } from "node:http";

// Import Internal Dependencies
import type { AccountsRequestError } from "./errors/AccountsRequestError.ts";

export class AccountsReply {
  static json(
    status: number,
    body: unknown,
    headers: Record<string, string> = {}
  ): AccountsReply {
    return new AccountsReply(
      status,
      body,
      headers
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

  static failure(
    error: AccountsRequestError,
    headers: Record<string, string> = {}
  ): AccountsReply {
    return new AccountsReply(
      error.status,
      {
        code: error.code,
        message: error.message
      },
      headers
    );
  }

  readonly status: number;
  readonly body: unknown;
  readonly headers: Readonly<Record<string, string>>;

  private constructor(
    status: number,
    body: unknown,
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
    if (this.body === undefined) {
      response.end();

      return;
    }

    response.setHeader(
      "content-type",
      "application/json; charset=utf-8"
    );
    response.end(
      JSON.stringify(this.body)
    );
  }
}
