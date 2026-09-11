// Import Internal Dependencies
import { WEBSOCKET_AUTH_PROTOCOL_PREFIX } from "../../transport/constants.ts";
import type { AuthenticationRequest } from "./AuthenticationProvider.ts";

// CONSTANTS
const kProtocolHeader = "sec-websocket-protocol";

function offeredProtocols(
  request: AuthenticationRequest
): string[] {
  const header = request.headers[kProtocolHeader];
  if (header === undefined) {
    return [];
  }

  const values = Array.isArray(header) ? header : [header];

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function decodeBase64Url(
  value: string
): string | null {
  try {
    return Buffer
      .from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64")
      .toString("utf8");
  }
  catch {
    return null;
  }
}

export function readCredential(
  request: AuthenticationRequest
): string | null {
  const offered = offeredProtocols(request)
    .find((value) => value.startsWith(WEBSOCKET_AUTH_PROTOCOL_PREFIX));
  if (offered === undefined) {
    return null;
  }

  return decodeBase64Url(
    offered.slice(WEBSOCKET_AUTH_PROTOCOL_PREFIX.length)
  );
}
