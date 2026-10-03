// Import Internal Dependencies
import { WEBSOCKET_AUTH_PROTOCOL_PREFIX } from "../../transport/constants.ts";
import type { AuthenticationRequest } from "./AuthenticationProvider.ts";
import { InvalidCredentialError } from "./errors/InvalidCredentialError.ts";

// CONSTANTS
const kProtocolHeader = "sec-websocket-protocol";
const kBase64UrlAlphabet = /^[A-Za-z0-9_-]*$/;
const kUtf8 = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true
});

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
): string {
  if (!kBase64UrlAlphabet.test(value) || value.length % 4 === 1) {
    throw new InvalidCredentialError("the credential is not base64url");
  }

  try {
    return kUtf8.decode(Buffer.from(value, "base64url"));
  }
  catch (cause) {
    throw new InvalidCredentialError(
      "the credential is not UTF-8",
      { cause }
    );
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
