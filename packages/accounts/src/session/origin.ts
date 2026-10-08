// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

export function isCrossOrigin(
  headers: IncomingHttpHeaders
): boolean {
  const { origin, host } = headers;
  if (origin === undefined) {
    return false;
  }

  return host === undefined || URL.parse(origin)?.host !== host;
}
