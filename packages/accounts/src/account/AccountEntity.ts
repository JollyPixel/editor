// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import { ADMIN_ROLE } from "./Account.ts";
import type { Username } from "./Username.ts";
import { AccountChangeRefusedError } from "./errors/AccountChangeRefusedError.ts";

export type AccountStatus = "active" | "pending";

export interface AccountEntityFields {
  id: string;
  username: string;
  role: string;
  status: AccountStatus;
  avatarHash: string | null;
  owner: boolean;
}

export class AccountEntity implements AccountEntityFields {
  static claim(
    username: Username
  ): AccountEntity {
    return AccountEntity.#create(
      username,
      ADMIN_ROLE,
      "active"
    ).withOwnership(true);
  }

  static register(
    username: Username,
    role: string
  ): AccountEntity {
    return AccountEntity.#create(
      username,
      role,
      "active"
    );
  }

  static request(
    username: Username,
    role: string
  ): AccountEntity {
    return AccountEntity.#create(
      username,
      role,
      "pending"
    );
  }

  static #create(
    username: Username,
    role: string,
    status: AccountStatus
  ): AccountEntity {
    return new AccountEntity({
      id: randomUUID(),
      username: username.value,
      role,
      status,
      avatarHash: null,
      owner: false
    });
  }

  readonly id: string;
  readonly username: string;
  readonly role: string;
  readonly status: AccountStatus;
  readonly avatarHash: string | null;
  readonly owner: boolean;

  constructor(
    fields: AccountEntityFields
  ) {
    this.id = fields.id;
    this.username = fields.username;
    this.role = fields.role;
    this.status = fields.status;
    this.avatarHash = fields.avatarHash;
    this.owner = fields.owner;
  }

  get pending(): boolean {
    return this.status === "pending";
  }

  get isAdmin(): boolean {
    return this.role === ADMIN_ROLE && !this.pending;
  }

  assertAdmin(): void {
    if (!this.isAdmin) {
      throw new AccountChangeRefusedError("only an admin manages accounts");
    }
  }

  assertOwner(): void {
    if (!this.owner) {
      throw new AccountChangeRefusedError(
        "only the owner transfers ownership"
      );
    }
  }

  assertNotOwner(): void {
    if (this.owner) {
      throw new AccountChangeRefusedError(
        `"${this.username}" is the owner`
      );
    }
  }

  approved(
    role: string
  ): AccountEntity {
    return new AccountEntity({
      ...this,
      role,
      status: "active"
    });
  }

  promotedToOwner(): AccountEntity {
    return this.withRole(ADMIN_ROLE).withOwnership(true);
  }

  withRole(
    role: string
  ): AccountEntity {
    return new AccountEntity({
      ...this,
      role
    });
  }

  withAvatar(
    avatarHash: string
  ): AccountEntity {
    return new AccountEntity({
      ...this,
      avatarHash
    });
  }

  withOwnership(
    owner: boolean
  ): AccountEntity {
    return new AccountEntity({
      ...this,
      owner
    });
  }
}
