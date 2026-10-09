// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { InvalidUsernameError } from "./errors/InvalidUsernameError.ts";

// CONSTANTS
const kMinLength = 2;
const kMaxLength = 32;
const kLengthMessage = `a username has ${kMinLength} to ${kMaxLength} characters`;
const kUsernameSchema = z.string()
  .normalize("NFKC")
  .trim()
  .min(kMinLength, kLengthMessage)
  .max(kMaxLength, kLengthMessage)
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N}_.-]*$/u,
    "a username starts with a letter or a digit and holds only letters, digits, \"_\", \".\" and \"-\""
  );

export class Username {
  static readonly MIN_LENGTH = kMinLength;
  static readonly MAX_LENGTH = kMaxLength;

  static parse(
    input: string
  ): Username {
    const parsed = kUsernameSchema.safeParse(input);
    if (!parsed.success) {
      throw new InvalidUsernameError(
        parsed.error.issues[0].message
      );
    }

    return new Username(parsed.data);
  }

  readonly value: string;
  readonly key: string;

  private constructor(
    value: string
  ) {
    this.value = value;
    this.key = value.toLowerCase();
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
