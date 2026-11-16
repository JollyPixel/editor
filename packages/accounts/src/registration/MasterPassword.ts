// Import Node.js Dependencies
import {
  createHash,
  timingSafeEqual
} from "node:crypto";

// Import Internal Dependencies
import { InvalidMasterPasswordError } from "./errors/InvalidMasterPasswordError.ts";
import { MasterPasswordRequiredError } from "./errors/MasterPasswordRequiredError.ts";

export class MasterPassword {
  #digest: Buffer;

  constructor(
    secret: string
  ) {
    if (secret.length === 0) {
      throw new RangeError("the master password is empty");
    }
    this.#digest = digest(secret);
  }

  assertGiven(
    given: string | undefined
  ): void {
    if (given === undefined) {
      throw new MasterPasswordRequiredError();
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
