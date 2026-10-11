// Import Third-party Dependencies
import type {
  Account,
  AccountsRoster
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { StudioShareLinks } from "../shares/StudioShareLinks.ts";

export interface StudioSignedIn {
  account: Account;
  roster: AccountsRoster;
  shares: StudioShareLinks;
  replaceAvatar(
    image: Blob
  ): Promise<Account>;
  signOut(): Promise<void>;
}
