// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";

export interface StoredAccountFields {
  id: string;
  username: string;
  role: string;
  /**
   * Hash of the uploaded avatar, `null` until the account uploads one.
   */
  avatarHash: string | null;
}

export class StoredAccount implements StoredAccountFields {
  readonly id: string;
  readonly username: string;
  readonly role: string;
  readonly avatarHash: string | null;

  constructor(
    fields: StoredAccountFields
  ) {
    this.id = fields.id;
    this.username = fields.username;
    this.role = fields.role;
    this.avatarHash = fields.avatarHash;
  }

  get isAdmin(): boolean {
    return this.role === ADMIN_ROLE;
  }

  withRole(
    role: string
  ): StoredAccount {
    return new StoredAccount({
      ...this,
      role
    });
  }

  withAvatar(
    avatarHash: string
  ): StoredAccount {
    return new StoredAccount({
      ...this,
      avatarHash
    });
  }
}
