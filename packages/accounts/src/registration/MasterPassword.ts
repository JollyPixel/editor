// Import Node.js Dependencies
import {
  createHash,
  timingSafeEqual
} from "node:crypto";

// Import Internal Dependencies
import type { AccountStatus } from "../account/AccountEntity.ts";
import { InvalidMasterPasswordError } from "./errors/InvalidMasterPasswordError.ts";
import { MasterPasswordRequiredError } from "./errors/MasterPasswordRequiredError.ts";

export interface MasterPasswordOptions {
  secret: string;
  /**
   * Registering without the secret creates an access request that an admin
   * approves, instead of an active account.
   * @default false
   */
  accessRequests?: boolean;
}

export class MasterPassword {
  #digest: Buffer;
  #accessRequests: boolean;

  constructor(
    options: MasterPasswordOptions
  ) {
    if (options.secret.length === 0) {
      throw new RangeError("the master password is empty");
    }
    this.#digest = digest(options.secret);
    this.#accessRequests = options.accessRequests ?? false;
  }

  admit(
    given: string | undefined,
    unclaimed: boolean
  ): AccountStatus {
    if (given === undefined) {
      if (unclaimed) {
        throw new MasterPasswordRequiredError();
      }

      return this.#accessRequests ? "pending" : "active";
    }
    if (!timingSafeEqual(digest(given), this.#digest)) {
      throw new InvalidMasterPasswordError();
    }

    return "active";
  }
}

function digest(
  value: string
): Buffer {
  return createHash("sha256").update(value).digest();
}
