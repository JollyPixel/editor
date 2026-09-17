// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import type {
  IncomingMessage,
  ServerResponse
} from "node:http";

export interface CapturedResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Buffer | null;
  ended: boolean;
  /**
   * Resolves once the handler calls `end()`.
   */
  done: Promise<CapturedResponse>;
}

export interface RequestOptions {
  method?: string;
  url: string;
}

/**
 * Minimal `IncomingMessage` stand-in: the handlers read `method` and `url`
 * only.
 */
export function request(
  options: RequestOptions
): IncomingMessage {
  const {
    method = "GET",
    url
  } = options;

  return {
    method,
    url
  } as IncomingMessage;
}

/**
 * Captures what a handler writes, exposing `done` because reads through an
 * `AssetSource` finish the response asynchronously.
 */
export function response(): {
  captured: CapturedResponse;
  response: ServerResponse;
} {
  let settle: (value: CapturedResponse) => void;
  const captured: CapturedResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    done: new Promise<CapturedResponse>((resolve) => {
      settle = resolve;
    })
  };

  const target = {
    get statusCode() {
      return captured.statusCode;
    },
    set statusCode(value: number) {
      captured.statusCode = value;
    },
    setHeader(
      key: string,
      value: string
    ) {
      captured.headers[key.toLowerCase()] = value;
    },
    end(
      payload?: Buffer | string
    ) {
      captured.body = payload === undefined ?
        null :
        Buffer.from(payload);
      captured.ended = true;
      settle(captured);
    }
  };

  return {
    captured,
    response: target as unknown as ServerResponse
  };
}

/**
 * Runs one request through a connect-style handler and reports whether it
 * passed the request on.
 */
export async function send(
  handler: (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) => void,
  options: RequestOptions
): Promise<CapturedResponse & { nexted: boolean; }> {
  const { captured, response: target } = response();
  let nexted = false;

  handler(
    request(options),
    target,
    () => {
      nexted = true;
      captured.ended = true;
    }
  );

  if (!nexted) {
    await captured.done;
  }

  return Object.assign(captured, { nexted });
}
