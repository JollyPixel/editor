// Import Internal Dependencies
import { AccountRepository } from "./AccountRepository.ts";
import { AvatarRepository } from "./AvatarRepository.ts";
import { SQL_SCHEMA } from "./schema.ts";
import { SessionRepository } from "./SessionRepository.ts";
import {
  IN_MEMORY_LOCATION,
  SqliteDatabase
} from "./SqliteDatabase.ts";

// CONSTANTS
export { IN_MEMORY_LOCATION } from "./SqliteDatabase.ts";

export class AccountsDatabase implements Disposable {
  static async open(
    location: string = IN_MEMORY_LOCATION
  ): Promise<AccountsDatabase> {
    return new AccountsDatabase(
      await SqliteDatabase.open(location)
    );
  }

  readonly accounts: AccountRepository;
  readonly sessions: SessionRepository;
  readonly avatars: AvatarRepository;

  #db: SqliteDatabase;

  constructor(
    db: SqliteDatabase
  ) {
    this.#db = db;
    this.#db.exec(SQL_SCHEMA);
    this.accounts = new AccountRepository(db);
    this.sessions = new SessionRepository(db);
    this.avatars = new AvatarRepository(db);
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
