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

/**
 * Opens the workspace event log, creating the state directory first:
 * sqlite will not create its file inside a directory that is missing.
 */
export function openAssetEventStore(
  root: string
): Promise<EventStore.EventStore> {
  return fs
    .mkdir(
      path.join(root, STATE_DIRECTORY),
      { recursive: true }
    )
    .then(() => EventStore.persistence.sqlite(
      path.join(root, EVENTS_DB_PATH)
    ));
}
