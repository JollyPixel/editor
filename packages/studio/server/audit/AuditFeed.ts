// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import type {
  Account,
  AccountActivity
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { AssetLog } from "./AssetLog.ts";
import { AuditCursor } from "./AuditCursor.ts";
import {
  ENTRY_CATEGORIES,
  type AuditEntry,
  type EditEntry
} from "./AuditEntry.ts";
import type { AuditLog } from "./AuditLog.ts";
import {
  EditRuns,
  type EditRun
} from "./EditRuns.ts";
import { NewestFirst } from "./NewestFirst.ts";
import type { StudioProject } from "../project/StudioProject.ts";
import {
  ACCOUNTS_CATEGORY,
  type AuditAccountActivity,
  type AuditActor,
  type AuditAsset,
  type AuditPage,
  type AuditQuery,
  type AuditRow
} from "../../shared/api/audit.ts";

// CONSTANTS
const kPageRows = 50;
const kMaxScanned = 5_000;
const kShareSubjectPrefix = "share:";
const kSystemNames: Readonly<Record<string, string>> = {
  "fs-watcher": "Files on disk",
  restore: "Restore",
  "dependency-backfill": "Dependency backfill"
};

type DraftRow = Exclude<AuditEntry, EditEntry> | EditRun;

export interface AuditFeedOptions {
  project: Pick<StudioProject, "access">;
  assets: AssetLog;
  audit: AuditLog;
  account: (accountId: string) => Account | null;
  assetPath: (assetId: string) => string | undefined;
}

export interface AuditFeedQuery extends AuditQuery {
  /**
   * @default 50
   */
  limit?: number;
}

export class AuditFeed {
  #project: Pick<StudioProject, "access">;
  #assets: AssetLog;
  #audit: AuditLog;
  #account: (accountId: string) => Account | null;
  #assetPath: (assetId: string) => string | undefined;

  constructor(
    options: AuditFeedOptions
  ) {
    this.#project = options.project;
    this.#assets = options.assets;
    this.#audit = options.audit;
    this.#account = options.account;
    this.#assetPath = options.assetPath;
  }

  async page(
    viewer: Account,
    query: AuditFeedQuery
  ): Promise<AuditPage> {
    const rights = this.#project.access.projectRights(viewer.role);
    rights.require("audit");

    const cursor = AuditCursor.decode(query.cursor);
    const consumed = cursor.toJSON();
    const limit = query.limit ?? kPageRows;
    const rows: DraftRow[] = [];
    const runs = new EditRuns();
    const items = new NewestFirst(new Map([
      ["events", this.#assets.events(cursor.events)],
      ["audit", this.#audit.newestFirst(cursor.audit)],
      ["tags", this.#assets.tags(cursor.tags)]
    ]));

    let scanned = 0;
    let complete = true;
    for await (const { source, item } of items) {
      if (query.from !== undefined && item.at < query.from) {
        break;
      }

      const entry = item.entry !== null &&
        matches(item.entry, query, rights.allows("manageAccess")) ?
        item.entry :
        null;
      const run = entry?.kind === "edit" ? runs.continued(entry) : null;
      if (
        (entry !== null && run === null && rows.length >= limit) ||
        scanned >= kMaxScanned
      ) {
        complete = false;
        break;
      }

      consumed[source] = item.position;
      scanned++;
      if (run !== null) {
        runs.extend(run, item.at);
      }
      else if (entry?.kind === "edit") {
        rows.push(runs.start(entry));
      }
      else if (entry !== null) {
        rows.push(entry);
      }
    }

    return {
      rows: rows.map((row) => this.#resolve(row)),
      next: complete ? null : AuditCursor.from(consumed).encode()
    };
  }

  #resolve(
    row: DraftRow
  ): AuditRow {
    const actor = this.#actor(row.actor);
    switch (row.kind) {
      case "edit":
        return {
          type: "edits",
          actor,
          asset: this.#asset(row.assetId, null),
          count: row.count,
          from: row.from,
          to: row.to
        };
      case "asset":
        return {
          type: "asset",
          action: row.action,
          actor,
          asset: this.#asset(row.assetId, row.path),
          at: row.at,
          ...(row.previousPath === undefined ? {} : { previousPath: row.previousPath })
        };
      case "tag":
        return {
          type: "tag",
          actor,
          asset: this.#asset(row.assetId, null),
          at: row.at,
          name: row.name,
          ...(row.message === undefined ? {} : { message: row.message })
        };
      case "account":
        return {
          type: "account",
          actor,
          at: row.at,
          activity: this.#activity(row.activity)
        };
      case "settings":
        return {
          type: "settings",
          actor,
          at: row.at,
          section: row.change.section,
          before: row.change.before,
          after: row.change.after
        };
      default:
        return row satisfies never;
    }
  }

  #actor(
    actor: EventStore.Actor
  ): AuditActor {
    if (actor.type === "system") {
      return {
        id: null,
        name: kSystemNames[actor.source] ?? actor.source,
        kind: "system"
      };
    }
    if (actor.id.startsWith(kShareSubjectPrefix)) {
      return {
        id: null,
        name: "Share link guest",
        kind: "share"
      };
    }

    const account = this.#account(actor.id);

    return account === null ?
      {
        id: actor.id,
        name: "Deleted user",
        kind: "deleted"
      } :
      {
        id: actor.id,
        name: account.username,
        kind: "user"
      };
  }

  #asset(
    assetId: string,
    path: string | null
  ): AuditAsset {
    return {
      id: assetId,
      path: this.#assetPath(assetId) ?? path
    };
  }

  #activity(
    activity: AccountActivity
  ): AuditAccountActivity {
    switch (activity.type) {
      case "share-link-created":
      case "share-link-revoked":
        return {
          type: activity.type,
          asset: this.#asset(activity.assetId, null)
        };
      case "registered":
        return {
          type: activity.type,
          username: activity.username,
          pending: activity.pending
        };
      case "approved":
        return {
          type: activity.type,
          username: activity.username,
          role: activity.role
        };
      case "role-changed":
        return {
          type: activity.type,
          username: activity.username,
          from: activity.from,
          to: activity.to
        };
      default:
        return {
          type: activity.type,
          username: activity.username
        };
    }
  }
}

function matches(
  entry: AuditEntry,
  query: AuditQuery,
  canManageAccess: boolean
): boolean {
  const category = ENTRY_CATEGORIES[entry.kind];
  if (category === ACCOUNTS_CATEGORY && !canManageAccess) {
    return false;
  }
  if (query.to !== undefined && entry.at > query.to) {
    return false;
  }
  if (query.category !== undefined && category !== query.category) {
    return false;
  }
  if (
    query.actor !== undefined &&
    (entry.actor.type !== "user" || entry.actor.id !== query.actor)
  ) {
    return false;
  }

  return query.asset === undefined ||
    ("assetId" in entry && entry.assetId === query.asset);
}
