// Import Node.js Dependencies
import type { IncomingMessage } from "node:http";

// Import Third-party Dependencies
import { splitTarget } from "@openally/servo";

export function requestPathname(
  request: IncomingMessage
): string {
  return splitTarget(request.url ?? "/").path;
}

export function readPathname(
  request: IncomingMessage
): string | null {
  return request.method === "GET" || request.method === "HEAD" ?
    requestPathname(request) :
    null;
}
