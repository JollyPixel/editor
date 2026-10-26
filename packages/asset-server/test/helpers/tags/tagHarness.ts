// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  AssetTags,
  type AssetKindHandler,
  type AssetTagsOptions,
  type Logger
} from "#src/index.ts";
import {
  syncHarness,
  type SyncHarness
} from "../backend.ts";
import {
  counterHandler,
  COUNTER_INCREMENTED,
  type CounterState
} from "../kinds.ts";
import {
  bytes,
  text
} from "../bytes.ts";

// CONSTANTS
export const TAG_ACTOR: EventStore.Actor = {
  type: "user",
  id: "alice"
};

export interface TagHarness extends AsyncDisposable {
  readonly sync: SyncHarness;
  readonly tags: AssetTags;
  readonly assetId: string;
  increment(): void;
  liveValue(): number | undefined;
  read(path: string): Promise<string | null>;
}

export interface TagHarnessOptions {
  compact?: boolean;
  handlers?: AssetKindHandler[];
  writer?: (sync: SyncHarness) => AssetTagsOptions["writer"];
  logger?: Logger;
}

export async function tagHarness(
  options: TagHarnessOptions = {}
): Promise<TagHarness> {
  const sync = await syncHarness({
    handlers: [counterHandler(), ...options.handlers ?? []],
    compact: options.compact
  });
  const created = (await sync.writer.create({
    path: "a.counter",
    data: bytes("0"),
    actor: TAG_ACTOR
  })).unwrap();
  const { assetId } = created;
  await sync.projector.flush();
  await sync.states.acquire(assetId, "counter");

  const tags = new AssetTags({
    eventStore: sync.eventStore,
    projector: sync.projector,
    writer: options.writer?.(sync) ?? sync.writer,
    flush: (id) => sync.flush(id),
    backups: sync.backups,
    kinds: sync.kinds,
    logger: options.logger
  });

  return {
    sync,
    tags,
    assetId,
    increment() {
      sync.eventStore.writer.append({
        assetType: "counter",
        assetId,
        eventType: COUNTER_INCREMENTED,
        eventData: { action: "increment" },
        actor: TAG_ACTOR
      }).unwrap();
    },
    liveValue() {
      const entry = sync.states.get(assetId);

      return (entry?.state as CounterState | undefined)?.value;
    },
    async read(path) {
      if (!await sync.source.exists(path)) {
        return null;
      }

      return text(await sync.source.read(path));
    },
    async [Symbol.asyncDispose]() {
      await sync[Symbol.asyncDispose]();
    }
  };
}
