// Import Internal Dependencies
import { ADMIN_ROLE } from "../account/Account.ts";

export type MembershipStatus = "active" | "pending";

export interface MembershipFields {
  realmId: string;
  accountId: string;
  role: string;
  status: MembershipStatus;
}

export class Membership implements MembershipFields {
  static active(
    realmId: string,
    accountId: string,
    role: string
  ): Membership {
    return new Membership({
      realmId,
      accountId,
      role,
      status: "active"
    });
  }

  static request(
    realmId: string,
    accountId: string,
    role: string
  ): Membership {
    return new Membership({
      realmId,
      accountId,
      role,
      status: "pending"
    });
  }

  readonly realmId: string;
  readonly accountId: string;
  readonly role: string;
  readonly status: MembershipStatus;

  constructor(
    fields: MembershipFields
  ) {
    this.realmId = fields.realmId;
    this.accountId = fields.accountId;
    this.role = fields.role;
    this.status = fields.status;
  }

  get pending(): boolean {
    return this.status === "pending";
  }

  get isAdmin(): boolean {
    return this.role === ADMIN_ROLE && !this.pending;
  }

  approved(
    role: string
  ): Membership {
    return new Membership({
      ...this,
      role,
      status: "active"
    });
  }

  withRole(
    role: string
  ): Membership {
    return new Membership({
      ...this,
      role
    });
  }
}
