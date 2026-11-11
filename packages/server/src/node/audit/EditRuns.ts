// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { EditEntry } from "./AuditEntry.ts";

// CONSTANTS
export const EDIT_RUN_GAP_MS = 5 * 60_000;

export interface EditRun {
  kind: "edit";
  actor: EventStore.Actor;
  assetId: string;
  count: number;
  from: number;
  to: number;
}

export class EditRuns {
  #runs = new Map<string, EditRun>();

  continued(
    entry: EditEntry
  ): EditRun | null {
    const run = this.#runs.get(runKey(entry));

    return run !== undefined && run.from - entry.at < EDIT_RUN_GAP_MS ?
      run :
      null;
  }

  extend(
    run: EditRun,
    at: number
  ): void {
    run.count++;
    run.from = at;
  }

  start(
    entry: EditEntry
  ): EditRun {
    const run: EditRun = {
      kind: "edit",
      actor: entry.actor,
      assetId: entry.assetId,
      count: 1,
      from: entry.at,
      to: entry.at
    };
    this.#runs.set(runKey(entry), run);

    return run;
  }
}

function runKey(
  entry: EditEntry
): string {
  const { actor } = entry;
  const actorKey = actor.type === "user" ?
    `user:${actor.id}` :
    `system:${actor.source}`;

  return `${actorKey}\u0000${entry.assetId}`;
}
