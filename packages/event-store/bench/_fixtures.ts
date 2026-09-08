// Import Node.js Dependencies
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Import Third-party Dependencies
import { mulberry32 } from "@jolly-pixel/bench";

// Import Internal Dependencies
import * as EventStore from "../src/index.ts";

// CONSTANTS
const kActor: EventStore.Actor = {
  type: "user",
  id: "alice"
};
const kAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
const kDefaultPayloadBytes = 64;

export const BACKEND_KINDS = [
  "memory",
  "sqlite:memory",
  "sqlite:file"
] as const;

export type BackendKind = typeof BACKEND_KINDS[number];

export const READ_BACKEND_KINDS = [
  "memory",
  "sqlite:memory"
] as const satisfies readonly BackendKind[];

export const CHECKPOINT_EVENT_TYPES = ["asset.snapshot"] as const;

export interface OpenedStore {
  kind: BackendKind;
  store: EventStore.EventStore;
  dispose(): void;
}

export async function openStore(
  kind: BackendKind
): Promise<OpenedStore> {
  if (kind === "memory") {
    const store = EventStore.persistence.memory();

    return {
      kind,
      store,
      dispose: () => store.close()
    };
  }

  if (kind === "sqlite:memory") {
    const store = await EventStore.persistence.sqlite();

    return {
      kind,
      store,
      dispose: () => store.close()
    };
  }

  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "jolly-event-store-")
  );
  const store = await EventStore.persistence.sqlite(
    path.join(directory, "events.db")
  );

  return {
    kind,
    store,
    dispose: () => {
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  };
}

export interface SeedOptions {
  assets: number;
  perAsset: number;
  /**
   * Zero-based index in each stream carrying a checkpoint event type.
   * Streams hold no checkpoint when omitted.
   */
  checkpointIndex?: number;
  payloadBytes?: number;
  seed?: number;
}

export function seedInputs(
  options: SeedOptions
): EventStore.AppendInput[] {
  const {
    assets,
    perAsset,
    checkpointIndex,
    payloadBytes = kDefaultPayloadBytes,
    seed
  } = options;

  const rng = mulberry32(seed);
  const inputs: EventStore.AppendInput[] = new Array(assets * perAsset);

  let cursor = 0;
  for (let index = 0; index < perAsset; index++) {
    const eventType = eventTypeAt(index, checkpointIndex);

    for (let asset = 0; asset < assets; asset++) {
      inputs[cursor] = {
        assetType: "texture",
        assetId: `asset-${asset}`,
        eventType,
        eventData: payload(rng, payloadBytes),
        actor: kActor
      };
      cursor++;
    }
  }

  return inputs;
}

export function seed(
  store: EventStore.EventStore,
  inputs: readonly EventStore.AppendInput[]
): void {
  for (const input of inputs) {
    store.writer.append(input).unwrap();
  }
}

export interface SeededStores {
  entries: OpenedStore[];
  dispose(): void;
}

export async function openSeededStores(
  inputs: readonly EventStore.AppendInput[],
  kinds: readonly BackendKind[] = BACKEND_KINDS
): Promise<SeededStores> {
  const entries: OpenedStore[] = [];

  for (const kind of kinds) {
    const opened = await openStore(kind);
    seed(opened.store, inputs);
    entries.push(opened);
  }

  return {
    entries,
    dispose: () => {
      for (const opened of entries) {
        opened.dispose();
      }
    }
  };
}

function eventTypeAt(
  index: number,
  checkpointIndex: number | undefined
): string {
  if (index === checkpointIndex) {
    return "asset.snapshot";
  }
  if (index === 0) {
    return "asset.created";
  }

  return "pixelart.stroke.applied";
}

function payload(
  rng: () => number,
  bytes: number
): Record<string, unknown> {
  return {
    x: Math.floor(rng() * 256),
    y: Math.floor(rng() * 256),
    pixels: randomString(rng, bytes)
  };
}

function randomString(
  rng: () => number,
  length: number
): string {
  let value = "";
  for (let index = 0; index < length; index++) {
    value += kAlphabet[Math.floor(rng() * kAlphabet.length)];
  }

  return value;
}
