// Import Third-party Dependencies
import type {
  Account,
  AccountsRoster
} from "@jolly-pixel/accounts";

export interface StudioSignedIn {
  account: Account;
  roster: AccountsRoster;
  signOut(): Promise<void>;
}
