// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  EVENTS_DB_PATH,
  STATE_DIRECTORY
} from "../constants.ts";
import type { AssetEventDataMap } from "../events/AssetEvents.ts";

export async function openAssetEventStore(
  root: string
): Promise<EventStore.TypedEventStore<AssetEventDataMap>> {
  return fs
    .mkdir(
      path.join(root, STATE_DIRECTORY),
      { recursive: true }
    )
    .then(() => EventStore.persistence.sqlite<AssetEventDataMap>(
      path.join(root, EVENTS_DB_PATH)
    ));
}
