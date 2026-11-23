// Import Third-party Dependencies
import {
  AccountsRequestError,
  AccountsRoster,
  type AccountsFailureCode,
  type Member,
  type AccountsClient
} from "@jolly-pixel/accounts";
import type { PeerMetadata } from "@jolly-pixel/network";
import type { Client } from "@jolly-pixel/network/client";
import type {
  PreferenceOverrides,
  Preferences
} from "@jolly-pixel/preferences";
import {
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { toPeerProfileMetadata } from "@jolly-pixel/ui/network";
import type {
  GameExportAssets,
  ProjectSections,
  ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import type { StudioClients } from "../api/StudioClients.ts";
import { AuditPages } from "../audit/AuditPages.ts";
import type { FileDownload } from "../browser/FileDownload.ts";
import { StudioAgentTokens } from "../golem/StudioAgentTokens.ts";
import type { PlayTarget } from "../play/StudioPlay.ts";
import { AccountPreferences } from "../preferences/AccountPreferences.ts";
import { StudioProjectSettings } from "../project/StudioProjectSettings.ts";
import { StudioShareLinks } from "../shares/StudioShareLinks.ts";
import { SessionRenewal } from "./SessionRenewal.ts";
import { STUDIO_USER_CHANGE } from "./StudioUser.ts";

// CONSTANTS
const kOutsiderCodes: ReadonlySet<AccountsFailureCode> = new Set([
  "membership-required",
  "account-pending"
]);

export type StudioAccountsClient = Pick<
  AccountsClient,
  "me" | "replaceAvatar" | "logout"
>;

export interface StudioSignInOptions {
  accounts: StudioAccountsClient;
  /**
   * Asks the user to sign in, when the session cookie holds no account.
   */
  signIn: () => Promise<Member>;
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
  sections: ProjectSections;
}

export class StudioSignedIn extends EventTarget {
  static async open(
    options: StudioSignInOptions
  ): Promise<StudioSignedIn> {
    const early = readAccountState(options.api);
    early.catch(() => undefined);
    const member = await signedInMember(options.accounts);
    const account = member ?? await options.signIn();
    const [overrides, rights, sections] = member === null ?
      await readAccountState(options.api) :
      await early;

    return new StudioSignedIn(account, {
      ...options,
      preferences: new AccountPreferences(overrides, {
        accountId: account.id,
        client: options.api.preferences
      }),
      rights,
      sections
    });
  }

  readonly online = true;
  readonly client: Client;
  readonly roster: AccountsRoster;
  readonly shares: StudioShareLinks;
  readonly agentTokens: StudioAgentTokens;
  readonly renewal: SessionRenewal;
  readonly project: StudioProjectSettings;

  #account: Member;
  #accounts: StudioAccountsClient;
  #api: StudioClients;
  #preferences: AccountPreferences;
  #reload: () => void;

  constructor(
    account: Member,
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
    this.agentTokens = new StudioAgentTokens(options.api.agentTokens);
    this.project = new StudioProjectSettings(
      options.api.project,
      options.rights,
      options.sections
    );
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

  get account(): Member {
    return this.#account;
  }

  get identity(): PeerIdentity {
    const { username, id, avatar } = this.#account;

    return peerIdentity(username, id, avatar);
  }

  get rights(): ProjectRights {
    return this.project.rights;
  }

  get playTarget(): PlayTarget {
    return {
      project: this.project
    };
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

  exportGame(
    assets: GameExportAssets
  ): Promise<FileDownload> {
    return this.#api.archive.downloadGame(assets);
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

async function signedInMember(
  accounts: StudioAccountsClient
): Promise<Member | null> {
  try {
    return await accounts.me();
  }
  catch (error) {
    if (
      error instanceof AccountsRequestError &&
      kOutsiderCodes.has(error.code)
    ) {
      return null;
    }

    throw error;
  }
}

function readAccountState(
  api: StudioClients
): Promise<[
  Map<string, PreferenceOverrides>,
  ProjectRights,
  ProjectSections
]> {
  return Promise.all([
    api.preferences.list(),
    api.project.rights(),
    api.project.sections()
  ]);
}
