// Import Internal Dependencies
import { base64url } from "./base64url.ts";
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

  return base64url(new Uint8Array(bits));
}
