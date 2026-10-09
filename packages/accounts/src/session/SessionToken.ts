// Import Node.js Dependencies
import {
  createHash,
  randomBytes
} from "node:crypto";

// CONSTANTS
const kTokenBytes = 32;
const kTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export class SessionToken {
  static mint(): SessionToken {
    return new SessionToken(
      randomBytes(kTokenBytes).toString("base64url")
    );
  }

  static parse(
    value: string
  ): SessionToken | null {
    return kTokenPattern.test(value)
      ? new SessionToken(value)
      : null;
  }

  readonly value: string;

  private constructor(
    value: string
  ) {
    this.value = value;
  }

  get digest(): Buffer {
    return createHash("sha256")
      .update(this.value)
      .digest();
  }
}
