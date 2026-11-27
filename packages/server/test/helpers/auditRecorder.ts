// Import Node.js Dependencies
import type { TestContext } from "node:test";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_UPDATED,
  CatalogActivity,
  SNAPSHOT_ACTOR
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  AuditEntry,
  EditRunEntry,
  EditVersions
} from "#src/audit/node/AuditEntry.ts";
import { AuditLog } from "#src/audit/node/AuditLog.ts";
import { AuditRecorder } from "#src/audit/node/AuditRecorder.ts";
import type { AuditCategory } from "#src/audit/api.ts";
import type { AuditSection } from "#src/project/ProjectSections.ts";

// CONSTANTS
export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const RECORDED_ASSET = "map";
const kKeepEverything: AuditSection = {
  keepRowsDays: null,
  keepVersionsDays: null
};

export interface RecorderHarness extends AsyncDisposable {
  events: EventStore.EventStore;
  audit: AuditLog;
  activity: CatalogActivity;
  recorder: AuditRecorder;
  summaries: string[][];
  at(minutes: number): Promise<void>;
  edit(actorId: string, assetId?: string): Promise<void>;
  lifecycle(
    eventType: string,
    eventData: object,
    actorId?: string
  ): Promise<number>;
  snapshot(): Promise<number>;
  retain(retention: AuditSection): Promise<void>;
  rows(category?: AuditCategory): AuditEntry[];
  edits(): string[];
  versions(): EditVersions[];
  tagNames(): Promise<string[]>;
}

export function writeData(
  extra: object = {}
): object {
  return {
    path: "map.bin",
    kind: "binary",
    hash: "h",
    size: 0,
    content: {
      type: "inline",
      data: new Uint8Array()
    },
    ...extra
  };
}

export async function recorderHarness(
  t: TestContext
): Promise<RecorderHarness> {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 0 });
  const events = EventStore.persistence.memory();
  const audit = await AuditLog.open(null);
  const activity = new CatalogActivity();
  const summaries: string[][] = [];
  const recorder = new AuditRecorder({
    audit,
    eventStore: events,
    activity,
    summarize: (assetId, from, to) => {
      summaries.push([assetId, from, to]);

      return Promise.resolve(`${from} -> ${to}`);
    },
    retention: kKeepEverything
  });

  async function append(
    input: Omit<EventStore.AppendInput, "assetType" | "assetId">,
    assetId = RECORDED_ASSET
  ): Promise<number> {
    const event = (await events.writer.append({
      assetType: "binary",
      assetId,
      ...input
    })).unwrap();
    await recorder.settled();

    return event.eventVersion;
  }

  function rows(
    category?: AuditCategory
  ): AuditEntry[] {
    return audit.page({
      category,
      withoutAccounts: false
    }, 100).map(({ entry }) => entry);
  }

  function editRuns(): EditRunEntry[] {
    return rows("edits").filter((entry) => entry.type === "edits");
  }

  return {
    events,
    audit,
    activity,
    recorder,
    summaries,
    async at(minutes) {
      t.mock.timers.tick(minutes * MINUTE - Date.now());
      await recorder.settled();
    },
    async edit(actorId, assetId) {
      await append({
        eventType: "binary.command",
        eventData: {},
        actor: {
          type: "user",
          id: actorId
        }
      }, assetId);
    },
    lifecycle: (eventType, eventData, actorId = "alice") => append({
      eventType,
      eventData,
      actor: {
        type: "user",
        id: actorId
      }
    }),
    snapshot: () => append({
      eventType: ASSET_UPDATED,
      eventData: writeData(),
      actor: SNAPSHOT_ACTOR
    }),
    async retain(retention) {
      recorder.replaceRetention(retention);
      await recorder.settled();
    },
    rows,
    edits: () => editRuns().map((entry) => {
      const actor = entry.actor.type === "user" ? entry.actor.id : entry.actor.source;
      const span = `${entry.from / MINUTE}-${entry.to / MINUTE}`;

      return `${actor} ${entry.assetId} x${entry.count} ${span}`;
    }),
    versions: () => editRuns().map(({ versions }) => versions),
    tagNames: async() => (await events.tags.list(RECORDED_ASSET)).map((tag) => tag.name).sort(),
    async [Symbol.asyncDispose]() {
      await recorder[Symbol.asyncDispose]();
      audit.close();
    }
  };
}
