// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_DELETED,
  isAssetEventType,
  parseAssetEvent,
  type AssetEvent,
  type CatalogActivity,
  type CatalogActivityEntry
} from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  actorKey,
  assetEntry,
  catalogEntry,
  type EditRunEntry
} from "./AuditEntry.ts";
import type { AuditLog } from "./AuditLog.ts";
import { HistoryPoints } from "./HistoryPoints.ts";
import type { AuditSection } from "../../project/ProjectSections.ts";

// CONSTANTS
export const EDIT_RUN_GAP_MS = 5 * 60_000;
const kSnapshotSource = "snapshot";
const kDayMs = 24 * 60 * 60_000;
const kPruneIntervalMs = kDayMs;

export interface AuditRecorderOptions {
  audit: AuditLog;
  eventStore: Pick<EventStore.EventStore, "reader" | "tags" | "subscribe">;
  summarize: ChangeSummary;
  activity: CatalogActivity;
  retention: AuditSection;
}

export type ChangeSummary = (
  assetId: string,
  from: string,
  to: string
) => Promise<string | null>;

interface OpenRun {
  id: number;
  entry: EditRunEntry;
  dirty: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export class AuditRecorder implements AsyncDisposable {
  #audit: AuditLog;
  #eventStore: AuditRecorderOptions["eventStore"];
  #summarize: ChangeSummary;
  #activity: CatalogActivity;
  #points: HistoryPoints;
  #retention: AuditSection;
  #runs = new Map<string, OpenRun>();
  #checkpoints = new Map<string, number>();
  #queue: Promise<void> = Promise.resolve();
  #pruneTimer: ReturnType<typeof setInterval>;
  #unsubscribe: () => void;
  #onApplied = (activity: CatalogActivityEntry): void => {
    void this.#enqueue(() => this.#applied(activity));
  };

  constructor(
    options: AuditRecorderOptions
  ) {
    this.#audit = options.audit;
    this.#eventStore = options.eventStore;
    this.#summarize = options.summarize;
    this.#activity = options.activity;
    this.#retention = options.retention;
    this.#points = new HistoryPoints(options.eventStore.tags, options.audit);
    this.#unsubscribe = options.eventStore.subscribe(
      (event) => void this.#enqueue(() => this.#appended(event))
    );
    this.#activity.on("applied", this.#onApplied);
    this.#pruneTimer = setInterval(() => this.#prune(), kPruneIntervalMs);
    this.#pruneTimer.unref?.();
    this.#prune();
  }

  settled(): Promise<void> {
    return this.#queue;
  }

  replaceRetention(
    retention: AuditSection
  ): void {
    this.#retention = retention;
    this.#prune();
  }

  async [Symbol.asyncDispose](): Promise<void> {
    clearInterval(this.#pruneTimer);
    this.#unsubscribe();
    this.#activity.off("applied", this.#onApplied);
    await this.#queue;
    for (const run of this.#runs.values()) {
      clearTimeout(run.timer);
      this.#audit.revise(run);
    }
    this.#runs.clear();
  }

  #prune(): void {
    void this.#enqueue(async() => {
      const { keepRowsDays, keepVersionsDays } = this.#retention;
      const now = Date.now();
      const released = [
        ...(keepRowsDays === null ?
          [] :
          this.#audit.prune(now - keepRowsDays * kDayMs)),
        ...(keepVersionsDays === null ?
          [] :
          this.#audit.forgetVersions(now - keepVersionsDays * kDayMs))
      ];
      for (const kept of released) {
        await this.#points.release(kept);
      }
    });
  }

  #enqueue(
    task: () => Promise<void> | void
  ): Promise<void> {
    const run = this.#queue.then(task);
    this.#queue = run.catch((error: unknown) => {
      console.error(error);
    });

    return run;
  }

  async #appended(
    event: EventStore.Event
  ): Promise<void> {
    if (!isAssetEventType(event.eventType)) {
      await this.#edit(event);

      return;
    }

    const parsed = parseAssetEvent(event);
    if (!parsed.ok) {
      return;
    }

    const asset = parsed.val;
    const { assetId, eventVersion } = asset;
    if (ASSET_CHECKPOINT_EVENT_TYPES.includes(asset.eventType)) {
      this.#checkpoints.set(assetId, eventVersion);
    }
    if (asset.actor.type === "system" && asset.actor.source === kSnapshotSource) {
      await this.#advance(assetId, eventVersion);

      return;
    }

    this.#audit.record(assetEntry(asset));
    if (asset.eventType === ASSET_DELETED) {
      this.#checkpoints.delete(assetId);
      for (const run of this.#assetRuns(assetId)) {
        await this.#close(run);
      }
    }
  }

  async #edit(
    event: EventStore.Event
  ): Promise<void> {
    const at = Date.parse(event.createdAt);
    const key = runKey(event.actor, event.assetId);
    const open = this.#runs.get(key);
    if (open !== undefined && at - open.entry.to < EDIT_RUN_GAP_MS) {
      open.entry.count++;
      open.entry.to = at;
      open.dirty = true;
      this.#schedule(key, open);

      return;
    }
    if (open !== undefined) {
      await this.#close(open);
    }

    const base = await this.#checkpoint(event.assetId);
    if (base !== null) {
      await this.#points.keep({
        assetId: event.assetId,
        version: base
      });
    }

    const entry: EditRunEntry = {
      type: "edits",
      actor: event.actor,
      assetId: event.assetId,
      count: 1,
      from: at,
      to: at,
      versions: {
        from: base,
        to: null
      },
      summary: null
    };
    const run: OpenRun = {
      id: this.#audit.record(entry),
      entry,
      dirty: true
    };
    this.#runs.set(key, run);
    this.#schedule(key, run);
  }

  #schedule(
    key: string,
    run: OpenRun
  ): void {
    clearTimeout(run.timer);
    run.timer = setTimeout(() => {
      void this.#enqueue(async() => {
        if (this.#runs.get(key) === run) {
          await this.#close(run);
        }
      });
    }, EDIT_RUN_GAP_MS);
    run.timer.unref?.();
  }

  async #advance(
    assetId: string,
    version: number
  ): Promise<void> {
    for (const run of this.#assetRuns(assetId)) {
      if (!run.dirty) {
        continue;
      }

      const { versions } = run.entry;
      const previous = versions.to;
      await this.#points.keep({ assetId, version });
      versions.to = version;
      run.dirty = false;
      this.#audit.revise(run);
      if (previous !== null) {
        await this.#points.release({
          assetId,
          version: previous
        });
      }
    }
  }

  async #close(
    run: OpenRun
  ): Promise<void> {
    clearTimeout(run.timer);
    const { entry } = run;
    const { versions } = entry;
    this.#runs.delete(runKey(entry.actor, entry.assetId));
    if (
      versions.from !== null &&
      versions.to !== null &&
      versions.from !== versions.to
    ) {
      entry.summary = await this.#summarize(
        entry.assetId,
        HistoryPoints.tagName(versions.from),
        HistoryPoints.tagName(versions.to)
      );
    }
    this.#audit.revise(run);
  }

  * #assetRuns(
    assetId: string
  ): IterableIterator<OpenRun> {
    for (const run of [...this.#runs.values()]) {
      if (run.entry.assetId === assetId) {
        yield run;
      }
    }
  }

  async #checkpoint(
    assetId: string
  ): Promise<number | null> {
    const known = this.#checkpoints.get(assetId);
    if (known !== undefined) {
      return known;
    }

    const [checkpoint] = await this.#eventStore.reader.listFromCheckpoints({
      assetId,
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    if (
      checkpoint === undefined ||
      !ASSET_CHECKPOINT_EVENT_TYPES.includes(checkpoint.eventType as AssetEvent["eventType"])
    ) {
      return null;
    }
    this.#checkpoints.set(assetId, checkpoint.eventVersion);

    return checkpoint.eventVersion;
  }

  #applied(
    activity: CatalogActivityEntry
  ): void {
    const entry = catalogEntry(activity);
    if (entry !== null) {
      this.#audit.record(entry);
    }
  }
}

function runKey(
  actor: EventStore.Actor,
  assetId: string
): string {
  return `${actorKey(actor)}\u0000${assetId}`;
}
