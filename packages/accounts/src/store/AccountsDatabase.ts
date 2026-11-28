// Import Internal Dependencies
import { AccountRepository } from "./AccountRepository.ts";
import { AgentTokenRepository } from "./AgentTokenRepository.ts";
import { AvatarRepository } from "./AvatarRepository.ts";
import { MembershipRepository } from "./MembershipRepository.ts";
import { PreferenceRepository } from "./PreferenceRepository.ts";
import {
  SCHEMA_VERSION,
  SQL_SCHEMA
} from "./schema.ts";
import { SessionRepository } from "./SessionRepository.ts";
import { ShareLinkRepository } from "./ShareLinkRepository.ts";
import {
  IN_MEMORY_LOCATION,
  SqliteDatabase
} from "./SqliteDatabase.ts";

// CONSTANTS
export { IN_MEMORY_LOCATION } from "./SqliteDatabase.ts";

interface VersionRow {
  user_version: number;
}

export class AccountsDatabase implements Disposable {
  static async open(
    location: string = IN_MEMORY_LOCATION
  ): Promise<AccountsDatabase> {
    return new AccountsDatabase(
      await SqliteDatabase.open(location)
    );
  }

  readonly accounts: AccountRepository;
  readonly memberships: MembershipRepository;
  readonly sessions: SessionRepository;
  readonly avatars: AvatarRepository;
  readonly agentAvatars: AvatarRepository;
  readonly shareLinks: ShareLinkRepository;
  readonly agentTokens: AgentTokenRepository;
  readonly preferences: PreferenceRepository;

  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
    assertSchemaVersion(db);
    this.#db.exec(SQL_SCHEMA);
    this.accounts = new AccountRepository(db);
    this.memberships = new MembershipRepository(db);
    this.sessions = new SessionRepository(db);
    this.avatars = new AvatarRepository(db, "account");
    this.agentAvatars = new AvatarRepository(db, "agent");
    this.shareLinks = new ShareLinkRepository(db);
    this.agentTokens = new AgentTokenRepository(db);
    this.preferences = new PreferenceRepository(db);
  }

  transaction<TResult>(
    body: () => TResult
  ): TResult {
    return this.#db.transaction(body);
  }

  close(): void {
    this.#db.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

function assertSchemaVersion(
  db: SqliteDatabase
): void {
  const version = db.get<VersionRow>("PRAGMA user_version")?.user_version ?? 0;
  const written = db.get(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'"
  ) !== undefined;
  if (written && version !== SCHEMA_VERSION) {
    throw new Error(
      `The accounts database has schema version ${version} and this server ` +
      `reads version ${SCHEMA_VERSION}: delete it to start over.`
    );
  }
}
