// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";

export type AccountStatus = "active" | "pending";

export interface StoredAccountFields {
  id: string;
  username: string;
  role: string;
  /**
   * `pending` until an admin approves the access request.
   */
  status: AccountStatus;
  /**
   * Hash of the uploaded avatar, `null` until the account uploads one.
   */
  avatarHash: string | null;
}

export class StoredAccount implements StoredAccountFields {
  readonly id: string;
  readonly username: string;
  readonly role: string;
  readonly status: AccountStatus;
  readonly avatarHash: string | null;

  constructor(
    fields: StoredAccountFields
  ) {
    this.id = fields.id;
    this.username = fields.username;
    this.role = fields.role;
    this.status = fields.status;
    this.avatarHash = fields.avatarHash;
  }

  get pending(): boolean {
    return this.status === "pending";
  }

  get isAdmin(): boolean {
    return this.role === ADMIN_ROLE && !this.pending;
  }

  withRole(
    role: string
  ): StoredAccount {
    return new StoredAccount({
      ...this,
      role
    });
  }

  approved(
    role: string
  ): StoredAccount {
    return new StoredAccount({
      ...this,
      role,
      status: "active"
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
