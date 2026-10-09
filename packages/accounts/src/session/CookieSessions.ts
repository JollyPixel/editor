// Import Node.js Dependencies
import type { IncomingHttpHeaders } from "node:http";

// Import Internal Dependencies
import type { Account } from "../account/Account.ts";
import type { AccountDirectory } from "../AccountDirectory.ts";
import type { SessionRepository } from "../store/SessionRepository.ts";
import type { SessionCookie } from "./SessionCookie.ts";
import { SessionToken } from "./SessionToken.ts";

export class CookieSessions {
  readonly cookie: SessionCookie;

  #sessions: SessionRepository;
  #directory: AccountDirectory;

  constructor(
    sessions: SessionRepository,
    directory: AccountDirectory,
    cookie: SessionCookie
  ) {
    this.#sessions = sessions;
    this.#directory = directory;
    this.cookie = cookie;
  }

  open(
    account: Account,
    secure: boolean
  ): string {
    const token = SessionToken.mint();
    this.#sessions.open(
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
      : this.#sessions.owner(token);

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
      : this.#sessions.close(token);
    if (accountId !== null) {
      this.#directory.revoke(accountId);
    }

    return this.cookie.clear(secure);
  }
}
