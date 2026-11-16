// Import Internal Dependencies
import {
  Membership,
  type MembershipStatus
} from "../realm/Membership.ts";
import type { SqliteDatabase } from "./SqliteDatabase.ts";

// CONSTANTS
const kColumns = "realm_id, user_id, role, status";

interface MembershipRow {
  realm_id: string;
  user_id: string;
  role: string;
  status: MembershipStatus;
}

interface CountRow {
  count: number;
}

interface RealmRow {
  realm_id: string;
}

export class MembershipRepository {
  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
  }

  find(
    realmId: string,
    accountId: string
  ): Membership | null {
    const row = this.#db.get<MembershipRow>(
      `SELECT ${kColumns} FROM memberships WHERE realm_id = ? AND user_id = ?`,
      realmId,
      accountId
    );

    return row === undefined ? null : toMembership(row);
  }

  inRealm(
    realmId: string
  ): Membership[] {
    return this.#db.all<MembershipRow>(
      `SELECT ${kColumns} FROM memberships WHERE realm_id = ?
       ORDER BY created_at, rowid`,
      realmId
    ).map(toMembership);
  }

  pendingSize(
    realmId: string
  ): number {
    return this.#db.get<CountRow>(
      `SELECT COUNT(*) AS count FROM memberships
       WHERE realm_id = ? AND status = 'pending'`,
      realmId
    )?.count ?? 0;
  }

  realmIds(): string[] {
    return this.#db.all<RealmRow>(
      "SELECT DISTINCT realm_id FROM memberships"
    ).map((row) => row.realm_id);
  }

  save(
    membership: Membership
  ): void {
    this.#db.run(
      `INSERT INTO memberships (realm_id, user_id, role, status, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (realm_id, user_id)
       DO UPDATE SET role = excluded.role, status = excluded.status`,
      membership.realmId,
      membership.accountId,
      membership.role,
      membership.status,
      Date.now()
    );
  }

  delete(
    realmId: string,
    accountId: string
  ): void {
    this.#db.run(
      "DELETE FROM memberships WHERE realm_id = ? AND user_id = ?",
      realmId,
      accountId
    );
  }
}

function toMembership(
  row: MembershipRow
): Membership {
  return new Membership({
    realmId: row.realm_id,
    accountId: row.user_id,
    role: row.role,
    status: row.status
  });
}
