// Import Third-party Dependencies
import {
  AccountRoles,
  type Accounts,
  type MasterPasswordOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { StudioAccess } from "../project/StudioAccess.ts";
import { MASTER_PASSWORD_ENV } from "../StudioServerSettings.ts";

export interface AccountsPolicy {
  /**
   * Role of new accounts, in place of the project's `access.defaultRole`.
   */
  defaultRole?: string;
  /**
   * Secret that registers without approval. Without it, anyone who reaches
   * the server can register.
   */
  masterPassword?: string;
}

export class AccountsAccess {
  static resolve(
    access: StudioAccess,
    policy: AccountsPolicy,
    source: string
  ): AccountsAccess {
    const secret = policy.masterPassword;
    if (secret === undefined || secret === "") {
      if (access.accessRequests) {
        throw new TypeError(
          `"${source}" sets accessRequests but ${MASTER_PASSWORD_ENV} is not set`
        );
      }

      return new AccountsAccess(access, policy, undefined);
    }

    return new AccountsAccess(access, policy, {
      secret,
      accessRequests: access.accessRequests
    });
  }

  readonly roles: AccountRoles;
  readonly masterPassword: MasterPasswordOptions | undefined;

  private constructor(
    access: StudioAccess,
    policy: AccountsPolicy,
    masterPassword: MasterPasswordOptions | undefined
  ) {
    this.roles = policy.defaultRole === undefined ?
      access.roles :
      new AccountRoles({
        roles: access.roles,
        defaultRole: policy.defaultRole
      });
    this.masterPassword = masterPassword;
  }

  applyTo(
    accounts: Accounts,
    renamed: ReadonlyMap<string, string>
  ): void {
    accounts.replaceRoles(this.roles, renamed);
    accounts.replaceAccessRequests(
      this.masterPassword?.accessRequests ?? false
    );
  }
}
