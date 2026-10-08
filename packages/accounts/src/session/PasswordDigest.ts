// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { InvalidPasswordError } from "./errors/InvalidPasswordError.ts";

// CONSTANTS
const kDigestSchema = z.string().regex(
  /^[A-Za-z0-9_-]{43}$/,
  "the password is not a pre-hashed digest"
);

export class PasswordDigest {
  static parse(
    value: string
  ): PasswordDigest {
    const parsed = kDigestSchema.safeParse(value);
    if (!parsed.success) {
      throw new InvalidPasswordError(
        parsed.error.issues[0].message
      );
    }

    return new PasswordDigest(parsed.data);
  }

  readonly value: string;

  private constructor(
    value: string
  ) {
    this.value = value;
  }
}
