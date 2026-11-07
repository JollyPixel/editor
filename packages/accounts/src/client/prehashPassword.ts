// Import Third-party Dependencies
import { encodeBase64Url } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { Username } from "../account/Username.ts";

// CONSTANTS
export const PREHASH_ITERATIONS = 600_000;
const kSaltPrefix = "jolly-pixel:v1:";
const kDigestBits = 256;
const kEncoder = new TextEncoder();

export async function prehashPassword(
  username: Username | string,
  password: string
): Promise<string> {
  const { key } = typeof username === "string" ?
    Username.parse(username) :
    username;
  const material = await crypto.subtle.importKey(
    "raw",
    kEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: kEncoder.encode(kSaltPrefix + key),
      iterations: PREHASH_ITERATIONS
    },
    material,
    kDigestBits
  );

  return encodeBase64Url(new Uint8Array(bits));
}
