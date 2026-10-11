// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";

export interface SessionRenewalOptions {
  accountId: string;
  currentAccount: () => Promise<Account | null>;
  signIn: () => Promise<Account>;
  reload: () => void;
}

export class SessionRenewal {
  #accountId: string;
  #currentAccount: () => Promise<Account | null>;
  #signIn: () => Promise<Account>;
  #reload: () => void;
  #listeners = new Set<() => void>();
  #renewing: Promise<void> | null = null;

  constructor(
    options: SessionRenewalOptions
  ) {
    this.#accountId = options.accountId;
    this.#currentAccount = options.currentAccount;
    this.#signIn = options.signIn;
    this.#reload = options.reload;
  }

  onRenewed(
    listener: () => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  renew(): Promise<void> {
    this.#renewing ??= this.#renew().finally(() => {
      this.#renewing = null;
    });

    return this.#renewing;
  }

  async #renew(): Promise<void> {
    let account: Account;
    try {
      account = await this.#currentAccount() ?? await this.#signIn();
    }
    catch {
      this.#reload();

      return;
    }

    if (account.id !== this.#accountId) {
      this.#reload();

      return;
    }

    for (const listener of this.#listeners) {
      listener();
    }
  }
}
