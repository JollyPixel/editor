// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { WEBSOCKET_AUTH_PROTOCOL_PREFIX } from "./constants.ts";

// CONSTANTS
const kBase64UrlAlphabet = /^[A-Za-z0-9_-]*$/;
const kUtf8 = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true
});

export function parseCredential(
  protocolHeader: string | string[] | undefined
): Result<string | undefined, string> {
  const offered = offeredProtocols(protocolHeader)
    .find((value) => value.startsWith(WEBSOCKET_AUTH_PROTOCOL_PREFIX));
  if (offered === undefined) {
    return Ok(undefined);
  }

  const encoded = offered.slice(WEBSOCKET_AUTH_PROTOCOL_PREFIX.length);
  if (!kBase64UrlAlphabet.test(encoded) || encoded.length % 4 === 1) {
    return Err("the credential is not base64url");
  }

  try {
    return Ok(kUtf8.decode(Buffer.from(encoded, "base64url")));
  }
  catch {
    return Err("the credential is not UTF-8");
  }
}

function offeredProtocols(
  protocolHeader: string | string[] | undefined
): string[] {
  if (protocolHeader === undefined) {
    return [];
  }

  const values = Array.isArray(protocolHeader) ?
    protocolHeader :
    [protocolHeader];

  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}
