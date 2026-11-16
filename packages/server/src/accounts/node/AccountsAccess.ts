// Import Third-party Dependencies
import type { JoinMode } from "@jolly-pixel/accounts";
import {
  AccountRoles,
  type Accounts,
  type AccountsRealm
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import type { ProjectAccess } from "../../project/node/ProjectAccess.ts";

export interface AccountsPolicy {
  /**
   * Role of new accounts, in place of the project's `access.defaultRole`.
   */
  defaultRole?: string;
  /**
   * How accounts join, in place of the project's `access.join`.
   */
  join?: JoinMode;
}

export class AccountsAccess {
  static resolve(
    access: ProjectAccess,
    policy: AccountsPolicy
  ): AccountsAccess {
    return new AccountsAccess(access, policy);
  }

  readonly roles: AccountRoles;
  readonly join: JoinMode;

  private constructor(
    access: ProjectAccess,
    policy: AccountsPolicy
  ) {
    this.roles = policy.defaultRole === undefined ?
      access.roles :
      new AccountRoles({
        roles: access.roles,
        defaultRole: policy.defaultRole
      });
    this.join = policy.join ?? access.join;
  }

  openRealm(
    accounts: Accounts,
    realmId: string
  ): AccountsRealm {
    return accounts.realm(realmId, {
      roles: this.roles,
      join: this.join
    });
  }

  applyTo(
    realm: AccountsRealm,
    renamed: ReadonlyMap<string, string>
  ): void {
    realm.replaceRoles(this.roles, renamed);
    realm.replaceJoin(this.join);
  }
}
