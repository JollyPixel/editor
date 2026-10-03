// Import Node.js Dependencies
import type { DatabaseSync } from "node:sqlite";

// CONSTANTS
const kIncrementalVacuum = 2;

export function enableIncrementalVacuum(
  db: DatabaseSync
): void {
  if (usesIncrementalVacuum(db)) {
    return;
  }

  db.exec("PRAGMA auto_vacuum = INCREMENTAL");
  const tables = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_schema"
  ).get();
  if (Number(tables?.count ?? 0) > 0) {
    db.exec("VACUUM");
  }
}

export function reclaimStatement(
  db: DatabaseSync
): string {
  return usesIncrementalVacuum(db) ?
    "PRAGMA incremental_vacuum" :
    "VACUUM";
}

function usesIncrementalVacuum(
  db: DatabaseSync
): boolean {
  return db.prepare("PRAGMA auto_vacuum").get()?.auto_vacuum ===
    kIncrementalVacuum;
}
