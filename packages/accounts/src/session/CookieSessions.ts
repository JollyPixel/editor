// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Internal Dependencies
import type { Account } from "../account/Account.ts";
import type { AccountDirectory } from "../AccountDirectory.ts";
import type { AccountStore } from "../store/AccountStore.ts";
import type { SessionCookie } from "./SessionCookie.ts";
import { SessionToken } from "./SessionToken.ts";

export class CookieSessions {
  readonly cookie: SessionCookie;

  #store: AccountStore;
  #directory: AccountDirectory;

  constructor(
    store: AccountStore,
    directory: AccountDirectory,
    cookie: SessionCookie
  ) {
    this.#store = store;
    this.#directory = directory;
    this.cookie = cookie;
  }

  open(
    account: Account,
    secure: boolean
  ): string {
    const token = SessionToken.mint();
    this.#store.openSession(
      token,
      account.id,
      Date.now() + this.cookie.ttlMs
    );

    return this.cookie.issue(
      token,
      secure
    );
  }

  account(
    headers: IncomingHttpHeaders
  ): Account | null {
    const token = this.cookie.read(headers);
    const accountId = token === null
      ? null
      : this.#store.sessionOwner(token);

    return accountId === null
      ? null
      : this.#directory.account(accountId);
  }

  close(
    headers: IncomingHttpHeaders,
    secure: boolean
  ): string {
    const token = this.cookie.read(headers);
    const accountId = token === null
      ? null
      : this.#store.closeSession(token);
    if (accountId !== null) {
      this.#directory.revoke(accountId);
    }

    return this.cookie.clear(secure);
  }
}
