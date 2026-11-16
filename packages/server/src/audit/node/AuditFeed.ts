// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  agentTokenId,
  type Account,
  type Member,
  type AccountActivity,
  type AgentToken
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import type { AssetLog } from "./AssetLog.ts";
import {
  ENTRY_CATEGORIES,
  type AuditEntry
} from "./AuditEntry.ts";
import type { AuditLog } from "./AuditLog.ts";
import {
  AuditRows,
  type AuditDraftRow
} from "./AuditRows.ts";
import { AuditTimeline } from "./AuditTimeline.ts";
import type { StudioProject } from "../../project/node/StudioProject.ts";
import {
  ACCOUNTS_CATEGORY,
  type AuditAccountActivity,
  type AuditActor,
  type AuditAsset,
  type AuditPage,
  type AuditQuery,
  type AuditRow
} from "../api.ts";

// CONSTANTS
const kPageRows = 50;
const kMaxScanned = 5_000;
const kShareSubjectPrefix = "share:";
const kSystemNames: Readonly<Record<string, string>> = {
  "fs-watcher": "Files on disk",
  restore: "Restore",
  "dependency-backfill": "Dependency backfill"
};

export interface AuditFeedOptions {
  project: Pick<StudioProject, "access">;
  assets: AssetLog;
  audit: AuditLog;
  account: (accountId: string) => Account | null;
  agentToken: (subject: string) => AgentToken | null;
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
  #agentToken: (subject: string) => AgentToken | null;
  #assetPath: (assetId: string) => string | undefined;

  constructor(
    options: AuditFeedOptions
  ) {
    this.#project = options.project;
    this.#assets = options.assets;
    this.#audit = options.audit;
    this.#account = options.account;
    this.#agentToken = options.agentToken;
    this.#assetPath = options.assetPath;
  }

  async page(
    viewer: Member,
    query: AuditFeedQuery
  ): Promise<AuditPage> {
    const rights = this.#project.access.projectRights(viewer.role);
    rights.require("audit");

    const limit = query.limit ?? kPageRows;
    const rows = new AuditRows();
    const timeline = new AuditTimeline(
      {
        assets: this.#assets,
        audit: this.#audit
      },
      query.cursor
    );

    let scanned = 0;
    let complete = true;
    for await (const item of timeline) {
      if (query.from !== undefined && item.at < query.from) {
        break;
      }

      const entry = item.entry !== null &&
        matches(item.entry, query, rights.allows("manageAccess")) ?
        item.entry :
        null;
      const full = entry !== null &&
        rows.opensRow(entry) &&
        rows.length >= limit;
      if (full || scanned >= kMaxScanned) {
        complete = false;
        break;
      }

      scanned++;
      if (entry !== null) {
        rows.add(entry);
      }
    }

    return {
      rows: rows.toArray().map((row) => this.#resolve(row)),
      next: complete ? null : timeline.cursor()
    };
  }

  #resolve(
    row: AuditDraftRow
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
    if (agentTokenId(actor.id) !== null) {
      return this.#agentActor(actor.id);
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

  #agentActor(
    subject: string
  ): AuditActor {
    const token = this.#agentToken(subject);
    if (token !== null) {
      const owner = this.#account(token.ownerId);
      if (owner !== null) {
        return {
          id: subject,
          name: `${token.name} (${owner.username})`,
          kind: "agent"
        };
      }
    }

    return {
      id: subject,
      name: "Deleted golem",
      kind: "deleted"
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
      case "agent-token-created":
      case "agent-token-revoked":
        return {
          type: activity.type,
          name: activity.name
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
