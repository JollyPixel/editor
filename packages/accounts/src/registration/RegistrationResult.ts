// Import Internal Dependencies
import type { Member } from "../account/Account.ts";

export type RegistrationResult =
  | {
    status: "active";
    account: Member;
  }
  | {
    status: "pending";
  };
