// Import Internal Dependencies
import type { Account } from "../account/Account.ts";

export type RegistrationResult =
  | {
    status: "active";
    account: Account;
  }
  | {
    status: "pending";
  };
