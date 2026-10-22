// Import Third-party Dependencies
import {
  AccountRoles,
  type Accounts,
  type MasterPasswordOptions
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { StudioAccountsOptions } from "./accounts.ts";
import type { StudioAccess } from "./project/StudioAccess.ts";

// CONSTANTS
export const MASTER_PASSWORD_ENV = "JOLLY_MASTER_PASSWORD";

export class AccountsAccess {
  static resolve(
    access: StudioAccess,
    options: StudioAccountsOptions,
    source: string
  ): AccountsAccess {
    const secret = options.env?.[MASTER_PASSWORD_ENV];
    if (secret === undefined || secret === "") {
      if (access.accessRequests) {
        throw new TypeError(
          `"${source}" sets accessRequests but ${MASTER_PASSWORD_ENV} is not set`
        );
      }

      return new AccountsAccess(access, options, undefined);
    }

    return new AccountsAccess(access, options, {
      secret,
      accessRequests: access.accessRequests
    });
  }

  readonly roles: AccountRoles;
  readonly masterPassword: MasterPasswordOptions | undefined;

  private constructor(
    access: StudioAccess,
    options: StudioAccountsOptions,
    masterPassword: MasterPasswordOptions | undefined
  ) {
    this.roles = options.defaultRole === undefined ?
      access.roles :
      new AccountRoles({
        roles: access.roles,
        defaultRole: options.defaultRole
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
