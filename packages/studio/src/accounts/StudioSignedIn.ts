// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  AccountsRoster,
  type Account,
  type AccountsClient
} from "@jolly-pixel/accounts";
import type { PeerMetadata } from "@jolly-pixel/network";
import type { Client } from "@jolly-pixel/network/client";
import {
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { ShareLinksClient } from "../shares/ShareLinksClient.ts";
import { StudioShareLinks } from "../shares/StudioShareLinks.ts";
import { SessionRenewal } from "./SessionRenewal.ts";

// CONSTANTS
export const SIGNED_IN_CHANGE = "change";

export type StudioAccountsClient = Pick<
  AccountsClient,
  "me" | "replaceAvatar" | "logout"
>;

export interface StudioSignInOptions {
  accounts: StudioAccountsClient;
  /**
   * Asks the user to sign in, when the session cookie holds no account.
   */
  signIn: () => Promise<Account>;
  shareLinks: ShareLinksClient;
  /**
   * Opens the shell's connection, joined with the account's peer profile.
   */
  connect: (profile: PeerMetadata) => Client;
  reload: () => void;
}

export class StudioSignedIn extends EventTarget {
  static async open(
    options: StudioSignInOptions
  ): Promise<StudioSignedIn> {
    const account = await options.accounts.me() ?? await options.signIn();

    return new StudioSignedIn(account, options);
  }

  readonly client: Client;
  readonly roster: AccountsRoster;
  readonly shares: StudioShareLinks;
  readonly renewal: SessionRenewal;

  #account: Account;
  #accounts: StudioAccountsClient;
  #reload: () => void;

  constructor(
    account: Account,
    options: StudioSignInOptions
  ) {
    super();
    this.#account = account;
    this.#accounts = options.accounts;
    this.#reload = options.reload;
    this.client = options.connect(toPeerProfileMetadata(this.identity));
    this.roster = AccountsRoster.join(this.client);
    this.shares = new StudioShareLinks(options.shareLinks, this.roster);
    this.renewal = new SessionRenewal({
      accountId: account.id,
      currentAccount: () => this.#accounts.me(),
      signIn: options.signIn,
      reload: options.reload
    });
    this.renewal.onRenewed(() => this.client.reconnect());
    this.client.on("unauthorized", () => {
      void this.renewal.renew();
    });
  }

  get account(): Account {
    return this.#account;
  }

  get identity(): PeerIdentity {
    const { username, id, avatar } = this.#account;

    return peerIdentity(username, id, avatar);
  }

  get isAdmin(): boolean {
    return this.#account.role === ADMIN_ROLE;
  }

  async replaceAvatar(
    image: Blob
  ): Promise<void> {
    this.#account = await this.#accounts.replaceAvatar(image);
    this.dispatchEvent(new Event(SIGNED_IN_CHANGE));
  }

  async signOut(): Promise<void> {
    try {
      await this.#accounts.logout();
    }
    finally {
      this.#reload();
    }
  }
}
