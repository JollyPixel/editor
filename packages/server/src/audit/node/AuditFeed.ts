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
import {
  actorKey,
  type AuditEntry,
  type EditVersions
} from "./AuditEntry.ts";
import { auditCsv } from "./AuditCsv.ts";
import type {
  AuditLog,
  AuditPosition,
  AuditSelection
} from "./AuditLog.ts";
import { HistoryPoints } from "./HistoryPoints.ts";
import type { Project } from "../../project/node/Project.ts";
import type { ProjectRights } from "../../project/ProjectRights.ts";
import type {
  AuditAccountActivity,
  AuditActor,
  AuditAsset,
  AuditFilter,
  AuditPage,
  AuditQuery,
  AuditRow,
  AuditVersions
} from "../api.ts";

// CONSTANTS
const kPageRows = 50;
const kExportBatch = 500;
const kShareSubjectPrefix = "share:";
const kCursorPattern = /^(\d+)\.(\d+)$/;
const kSystemNames: Readonly<Record<string, string>> = {
  "fs-watcher": "Files on disk",
  restore: "Restore",
  "dependency-backfill": "Dependency backfill"
};

export interface AuditFeedOptions {
  project: Pick<Project, "access">;
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
  #project: Pick<Project, "access">;
  #audit: AuditLog;
  #account: (accountId: string) => Account | null;
  #agentToken: (subject: string) => AgentToken | null;
  #assetPath: (assetId: string) => string | undefined;

  constructor(
    options: AuditFeedOptions
  ) {
    this.#project = options.project;
    this.#audit = options.audit;
    this.#account = options.account;
    this.#agentToken = options.agentToken;
    this.#assetPath = options.assetPath;
  }

  page(
    viewer: Member,
    query: AuditFeedQuery
  ): AuditPage {
    const { cursor, limit = kPageRows, ...filter } = query;
    const records = this.#audit.page(
      this.#selection(viewer, filter),
      limit + 1,
      decodeCursor(cursor)
    );
    const rows = records.slice(0, limit);
    const last = rows.at(-1);

    return {
      rows: rows.map(({ entry }) => this.#resolve(entry)),
      next: records.length > limit && last !== undefined ?
        encodeCursor(last) :
        null
    };
  }

  actors(
    viewer: Member
  ): AuditActor[] {
    return this.#audit.actors(this.#selection(viewer, {}))
      .map((actor) => this.#actor(actor))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  export(
    viewer: Member,
    filter: AuditFilter
  ): IterableIterator<string> {
    return auditCsv(this.#rows(this.#selection(viewer, filter)));
  }

  * #rows(
    selection: AuditSelection
  ): IterableIterator<AuditRow> {
    let after: AuditPosition | undefined;
    do {
      const records = this.#audit.page(selection, kExportBatch, after);
      for (const { entry } of records) {
        yield this.#resolve(entry);
      }
      after = records.length === kExportBatch ? records.at(-1) : undefined;
    }
    while (after !== undefined);
  }

  #rights(
    viewer: Member
  ): ProjectRights {
    const rights = this.#project.access.projectRights(viewer.role);
    rights.require("audit");

    return rights;
  }

  #selection(
    viewer: Member,
    filter: AuditFilter
  ): AuditSelection {
    return {
      ...filter,
      withoutAccounts: !this.#rights(viewer).allows("manageAccess")
    };
  }

  #resolve(
    entry: AuditEntry
  ): AuditRow {
    const actor = this.#actor(entry.actor);
    switch (entry.type) {
      case "edits": {
        const { assetId, versions, ...run } = entry;

        return {
          ...run,
          actor,
          asset: this.#asset(assetId, null),
          versions: historyVersions(versions)
        };
      }
      case "asset": {
        const { assetId, path, ...change } = entry;

        return {
          ...change,
          actor,
          asset: this.#asset(assetId, path)
        };
      }
      case "tag": {
        const { assetId, ...tag } = entry;

        return {
          ...tag,
          actor,
          asset: this.#asset(assetId, null)
        };
      }
      case "folder":
        return {
          ...entry,
          actor
        };
      case "account":
        return {
          ...entry,
          actor,
          activity: this.#activity(entry.activity)
        };
      case "settings": {
        const { change, ...settings } = entry;

        return {
          ...settings,
          ...change,
          actor
        };
      }
      default:
        return entry satisfies never;
    }
  }

  #actor(
    actor: EventStore.Actor
  ): AuditActor {
    const key = actorKey(actor);
    if (actor.type === "system") {
      return {
        key,
        id: null,
        name: kSystemNames[actor.source] ?? actor.source,
        kind: "system"
      };
    }
    if (actor.id.startsWith(kShareSubjectPrefix)) {
      return {
        key,
        id: null,
        name: "Share link guest",
        kind: "share"
      };
    }
    if (agentTokenId(actor.id) !== null) {
      return this.#agentActor(key, actor.id);
    }

    const account = this.#account(actor.id);

    return account === null ?
      {
        key,
        id: actor.id,
        name: "Deleted user",
        kind: "deleted"
      } :
      {
        key,
        id: actor.id,
        name: account.username,
        kind: "user"
      };
  }

  #agentActor(
    key: string,
    subject: string
  ): AuditActor {
    const token = this.#agentToken(subject);
    if (token !== null) {
      const owner = this.#account(token.ownerId);
      if (owner !== null) {
        return {
          key,
          id: subject,
          name: `${token.name} (${owner.username})`,
          kind: "agent"
        };
      }
    }

    return {
      key,
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
      case "joined":
        return {
          type: activity.type,
          username: activity.username,
          pending: activity.pending
        };
      case "approved":
      case "invited":
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

function historyVersions(
  versions: EditVersions
): AuditVersions | null {
  const { from, to } = versions;

  return from === null || to === null || from === to ?
    null :
    {
      from: HistoryPoints.tagName(from),
      to: HistoryPoints.tagName(to)
    };
}

function encodeCursor(
  position: AuditPosition
): string {
  return `${position.at}.${position.id}`;
}

function decodeCursor(
  cursor: string | undefined
): AuditPosition | undefined {
  const match = kCursorPattern.exec(cursor ?? "");

  return match === null ?
    undefined :
    {
      at: Number(match[1]),
      id: Number(match[2])
    };
}
