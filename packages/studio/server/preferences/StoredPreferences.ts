// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";
import type {
  PreferencesReply,
  ScopePreferencesReply
} from "../../shared/api/preferences.ts";
import { UnknownScopeError } from "./errors/UnknownScopeError.ts";

export class StoredPreferences {
  #accounts: Accounts;
  #scopes: PreferenceScopes;

  constructor(
    accounts: Accounts,
    scopes: PreferenceScopes
  ) {
    this.#accounts = accounts;
    this.#scopes = scopes;
  }

  list(
    account: Account
  ): PreferencesReply {
    return {
      scopes: Object.fromEntries(
        this.#scopes.prune(this.#accounts.preferences(account.id))
      )
    };
  }

  replace(
    account: Account,
    scopeName: string,
    body: unknown
  ): ScopePreferencesReply {
    const scope = this.#scopes.find(scopeName);
    if (scope === undefined) {
      throw new UnknownScopeError(scopeName);
    }

    const overrides = scope.parse(body);
    this.#accounts.replacePreferences(account.id, scope.name, overrides);

    return {
      overrides
    };
  }
}
