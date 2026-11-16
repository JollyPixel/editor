// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import type { Username } from "./Username.ts";
import { AccountChangeRefusedError } from "./errors/AccountChangeRefusedError.ts";

export interface AccountEntityFields {
  id: string;
  username: string;
  avatarHash: string | null;
  owner: boolean;
}

export class AccountEntity implements AccountEntityFields {
  static claim(
    username: Username
  ): AccountEntity {
    return AccountEntity.register(username).withOwnership(true);
  }

  static register(
    username: Username
  ): AccountEntity {
    return new AccountEntity({
      id: randomUUID(),
      username: username.value,
      avatarHash: null,
      owner: false
    });
  }

  readonly id: string;
  readonly username: string;
  readonly avatarHash: string | null;
  readonly owner: boolean;

  constructor(
    fields: AccountEntityFields
  ) {
    this.id = fields.id;
    this.username = fields.username;
    this.avatarHash = fields.avatarHash;
    this.owner = fields.owner;
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
