// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import { InvalidTagNameError } from "./errors/InvalidTagNameError.ts";

// CONSTANTS
export const TAG_NAME_MAX_LENGTH = 64;

export const TAG_NAME_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]*$";

const kTagNamePattern = new RegExp(TAG_NAME_PATTERN);
const kRestorePointPrefix = "restore/";

export class TagName {
  readonly value: string;

  static parse(
    value: string
  ): Result<TagName, InvalidTagNameError> {
    if (
      value.length > TAG_NAME_MAX_LENGTH ||
      !kTagNamePattern.test(value)
    ) {
      const error = new InvalidTagNameError(value, TAG_NAME_MAX_LENGTH);

      return Err(error);
    }

    return Ok(new TagName(value));
  }

  static restorePoint(
    eventVersion: number
  ): TagName {
    return new TagName(`${kRestorePointPrefix}${eventVersion}`);
  }

  static isRestorePoint(
    name: string
  ): boolean {
    return name.startsWith(kRestorePointPrefix);
  }

  private constructor(
    value: string
  ) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}
