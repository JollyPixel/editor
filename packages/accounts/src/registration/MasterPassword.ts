// Import Node.js Dependencies
import {
  createHash,
  timingSafeEqual
} from "node:crypto";

// Import Internal Dependencies
import { InvalidMasterPasswordError } from "./errors/InvalidMasterPasswordError.ts";
import { MasterPasswordRequiredError } from "./errors/MasterPasswordRequiredError.ts";

export interface MasterPasswordOptions {
  secret: string;
  /**
   * Every registration must give the secret, not only the first one.
   * @default false
   */
  required?: boolean;
}

export class MasterPassword {
  #digest: Buffer;
  #required: boolean;

  constructor(
    options: MasterPasswordOptions
  ) {
    if (options.secret.length === 0) {
      throw new RangeError("the master password is empty");
    }
    this.#digest = digest(options.secret);
    this.#required = options.required ?? false;
  }

  admit(
    given: string | undefined,
    unclaimed: boolean
  ): void {
    if (given === undefined) {
      if (unclaimed || this.#required) {
        throw new MasterPasswordRequiredError();
      }

      return;
    }
    if (!timingSafeEqual(digest(given), this.#digest)) {
      throw new InvalidMasterPasswordError();
    }
  }
}

function digest(
  value: string
): Buffer {
  return createHash("sha256").update(value).digest();
}
