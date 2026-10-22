// Import Third-party Dependencies
import type { FastifyRequest } from "fastify";
import { AccountsError } from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";
import { InvalidPreferencesError } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { ApiError } from "../errors/ApiError.ts";
import { accountsFailure } from "../errors/accountsFailure.ts";
import { requireAccount } from "../requireAccount.ts";
import type { PreferenceScopes } from "../../../shared/PreferenceScopes.ts";
import type {
  PreferencesReply,
  ScopePreferencesReply
} from "../../../shared/api/preferences.ts";

export interface ReplacePreferencesRoute {
  Params: {
    scope: string;
  };
  Body: Record<string, unknown>;
}

export class PreferencesController {
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
    request: FastifyRequest
  ): PreferencesReply {
    const account = requireAccount(this.#accounts, request);
    const stored = this.#accounts.preferences(account.id);

    return {
      scopes: Object.fromEntries(this.#scopes.prune(stored))
    };
  }

  replace(
    request: FastifyRequest<ReplacePreferencesRoute>
  ): ScopePreferencesReply {
    const account = requireAccount(this.#accounts, request);
    const scope = this.#scopes.find(request.params.scope);
    if (scope === undefined) {
      throw new ApiError(
        404,
        "not-found",
        `no "${request.params.scope}" preference scope`
      );
    }

    const overrides = scope.parse(request.body);
    this.#accounts.replacePreferences(account.id, scope.name, overrides);

    return {
      overrides
    };
  }

  failure(
    error: unknown
  ): unknown {
    if (error instanceof AccountsError) {
      return accountsFailure(error);
    }
    if (error instanceof InvalidPreferencesError) {
      return new ApiError(400, "invalid-request", error.message);
    }

    return error;
  }
}
