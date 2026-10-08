// Import Third-party Dependencies
import type {
  Account,
  AccountsRoster
} from "@jolly-pixel/accounts";

export interface StudioSignedIn {
  account: Account;
  roster: AccountsRoster;
  replaceAvatar(
    image: Blob
  ): Promise<Account>;
  signOut(): Promise<void>;
}
