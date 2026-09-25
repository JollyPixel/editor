// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import { once } from "node:events";
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface CapturedResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer | null;
  nexted: boolean;
}

export interface RequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
}

export type ConnectHandler = (
  request: http.IncomingMessage,
  response: http.ServerResponse,
  next: () => void
) => void;

/**
 * Runs one request through a connect-style handler over a real socket. The
 * raw `url` is sent as is, so dot segments reach the handler untouched.
 */
export async function send(
  handler: ConnectHandler,
  options: RequestOptions
): Promise<CapturedResponse> {
  const {
    method = "GET",
    url,
    headers = {}
  } = options;

  let nexted = false;
  const server = http.createServer((request, response) => {
    handler(request, response, () => {
      nexted = true;
      response.statusCode = 204;
      response.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const response = await new Promise<http.IncomingMessage>(
      (resolve, reject) => {
        const request = http.request({
          host: "127.0.0.1",
          port: portOf(server.address()),
          method,
          path: url,
          headers
        });
        request.once("response", resolve);
        request.once("error", reject);
        request.end();
      }
    );
    const chunks: Buffer[] = [];
    for await (const chunk of response) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    return {
      statusCode: response.statusCode ?? 0,
      headers: response.headers,
      body: body.byteLength === 0 ? null : body,
      nexted
    };
  }
  finally {
    server.closeAllConnections();
    server.close();
  }
}

function portOf(
  address: string | AddressInfo | null
): number {
  if (address === null || typeof address === "string") {
    throw new Error("Test server is not listening on a TCP port");
  }

  return address.port;
}
