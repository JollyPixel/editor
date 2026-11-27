// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ADMIN_ROLE,
  type Member
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { AuditFeed } from "#src/audit/node/AuditFeed.ts";
import {
  settingsEntry,
  type EditVersions
} from "#src/audit/node/AuditEntry.ts";
import { AuditLog } from "#src/audit/node/AuditLog.ts";
import { ProjectAccess } from "#src/project/node/ProjectAccess.ts";
import type { AuditRow } from "#src/audit/api.ts";

// CONSTANTS
export const MINUTE = 60_000;
const kUsernames: Record<string, string> = {
  alice: "Alice",
  bob: "Bob"
};
const kAuditor = "auditor";
const kAccess = ProjectAccess.from({
  defaultRole: kAuditor,
  roles: {
    [kAuditor]: {
      "studio.$audit": "read"
    }
  },
  join: "open"
}, "audit test");
export const ADMIN: Member = {
  id: "alice",
  username: "Alice",
  role: ADMIN_ROLE,
  owner: true
};
export const AUDITOR: Member = {
  id: "bob",
  username: "Bob",
  role: kAuditor,
  owner: false
};

export interface FeedHarness extends Disposable {
  audit: AuditLog;
  feed: AuditFeed;
  edits(
    actorId: string,
    assetId: string,
    minutes: [from: number, to: number],
    versions?: EditVersions
  ): void;
  settings(actorId: string, minute: number): void;
}

export function user(
  id: string
): EventStore.Actor {
  return {
    type: "user",
    id
  };
}

export async function feedHarness(): Promise<FeedHarness> {
  const audit = await AuditLog.open(null);

  return {
    audit,
    feed: new AuditFeed({
      project: {
        access: kAccess
      },
      audit,
      account: (id) => (Object.hasOwn(kUsernames, id) ?
        {
          id,
          username: kUsernames[id],
          role: "member",
          owner: false
        } :
        null),
      agentToken: (subject) => (subject === "agent:builder" ?
        {
          id: "builder",
          ownerId: "bob",
          name: "Builder",
          createdAt: 0
        } :
        null),
      assetPath: (assetId) => (assetId === "gone" ? undefined : `${assetId}.voxelmap.json`)
    }),
    edits(
      actorId,
      assetId,
      [from, to],
      versions = {
        from: null,
        to: null
      }
    ) {
      audit.record({
        type: "edits",
        actor: user(actorId),
        assetId,
        count: 1,
        from: from * MINUTE,
        to: to * MINUTE,
        versions,
        summary: null
      });
    },
    settings(actorId, minute) {
      audit.record(settingsEntry(user(actorId), {
        section: "kinds",
        before: {},
        after: {}
      }, minute * MINUTE));
    },
    [Symbol.dispose]() {
      audit.close();
    }
  };
}

export function summary(
  row: AuditRow
): string {
  return row.type === "edits" ?
    `${row.actor.name} ${row.asset.id} ${row.from / MINUTE}-${row.to / MINUTE}` :
    `${row.actor.name} ${row.type}`;
}
