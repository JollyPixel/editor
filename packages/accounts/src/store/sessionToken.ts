// Import Node.js Dependencies
import {
  createHash,
  randomBytes
} from "node:crypto";

// CONSTANTS
const kTokenBytes = 32;
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function mintSessionToken(): string {
  return randomBytes(kTokenBytes).toString("base64url");
}

export function digestSessionToken(
  token: string
): Buffer {
  return createHash("sha256")
    .update(token)
    .digest();
}
