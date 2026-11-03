// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";

export function requestPathname(
  request: IncomingMessage
): string {
  return URL.parse(
    request.url ?? "/",
    "http://localhost"
  )?.pathname ?? "/";
}

export function readPathname(
  request: IncomingMessage
): string | null {
  return request.method === "GET" || request.method === "HEAD" ?
    requestPathname(request) :
    null;
}
