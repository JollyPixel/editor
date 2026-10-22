// Import Third-party Dependencies
import {
  AccountsRoster,
  type Account,
  type AccountsClient
} from "@jolly-pixel/accounts";
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import type { PeerMetadata } from "@jolly-pixel/network";
import type { Client } from "@jolly-pixel/network/client";
import {
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { StudioClients } from "../api/StudioClients.ts";
import { AuditPages } from "../audit/AuditPages.ts";
import type { FileDownload } from "../browser/FileDownload.ts";
import { AccountPreferences } from "../preferences/AccountPreferences.ts";
import { StudioProjectSettings } from "../project/StudioProjectSettings.ts";
import { StudioShareLinks } from "../shares/StudioShareLinks.ts";
import type { ProjectRights } from "../../shared/ProjectRights.ts";
import { SessionRenewal } from "./SessionRenewal.ts";
import { STUDIO_USER_CHANGE } from "./StudioUser.ts";

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
  api: StudioClients;
  /**
   * Opens the shell's connection, joined with the account's peer profile.
   */
  connect: (profile: PeerMetadata) => Client;
  reload: () => void;
}

export interface StudioSignedInOptions extends StudioSignInOptions {
  preferences: AccountPreferences;
  rights: ProjectRights;
}

export class StudioSignedIn extends EventTarget {
  static async open(
    options: StudioSignInOptions
  ): Promise<StudioSignedIn> {
    const account = await options.accounts.me() ?? await options.signIn();
    const [preferences, rights] = await Promise.all([
      AccountPreferences.load({
        accountId: account.id,
        client: options.api.preferences
      }),
      options.api.project.rights()
    ]);

    return new StudioSignedIn(account, {
      ...options,
      preferences,
      rights
    });
  }

  readonly online = true;
  readonly client: Client;
  readonly roster: AccountsRoster;
  readonly shares: StudioShareLinks;
  readonly renewal: SessionRenewal;
  readonly project: StudioProjectSettings;

  #account: Account;
  #accounts: StudioAccountsClient;
  #api: StudioClients;
  #preferences: AccountPreferences;
  #reload: () => void;

  constructor(
    account: Account,
    options: StudioSignedInOptions
  ) {
    super();
    this.#account = account;
    this.#accounts = options.accounts;
    this.#api = options.api;
    this.#preferences = options.preferences;
    this.#reload = options.reload;
    this.client = options.connect(toPeerProfileMetadata(this.identity));
    this.roster = AccountsRoster.join(this.client);
    this.shares = new StudioShareLinks(
      options.api.shares,
      this.roster,
      options.rights.allows("share")
    );
    this.project = new StudioProjectSettings(options.api.project, options.rights);
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

  get rights(): ProjectRights {
    return this.project.rights;
  }

  get preferences(): Preferences {
    return this.#preferences.preferences;
  }

  onPreferenceError(
    listener: (message: string) => void
  ): () => void {
    return this.#preferences.onError(listener);
  }

  exportProject(): Promise<FileDownload> {
    return this.#api.archive.download();
  }

  auditPages(): AuditPages {
    return new AuditPages(this.#api.audit);
  }

  async replaceAvatar(
    image: Blob
  ): Promise<void> {
    this.#account = await this.#accounts.replaceAvatar(image);
    this.dispatchEvent(new Event(STUDIO_USER_CHANGE));
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
