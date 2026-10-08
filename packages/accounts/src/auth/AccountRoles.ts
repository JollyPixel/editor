// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";

export interface AccountRolesOptions {
  roles: Iterable<string>;
  defaultRole: string;
}

export class AccountRoles implements Iterable<string> {
  readonly defaultRole: string;

  #roles: ReadonlySet<string>;

  constructor(
    options: AccountRolesOptions
  ) {
    this.#roles = new Set([
      ADMIN_ROLE,
      ...options.roles
    ]);

    if (!this.#roles.has(options.defaultRole)) {
      throw new RangeError(
        `the default role "${options.defaultRole}" is not a role`
      );
    }
    this.defaultRole = options.defaultRole;
  }

  has(
    role: string
  ): boolean {
    return this.#roles.has(role);
  }

  effective(
    role: string
  ): string {
    return this.#roles.has(role)
      ? role
      : this.defaultRole;
  }

  [Symbol.iterator](): IterableIterator<string> {
    return this.#roles.values();
  }
}
