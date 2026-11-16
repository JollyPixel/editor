// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  AuditEntry,
  EditEntry
} from "./AuditEntry.ts";

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

export type AuditDraftRow = Exclude<AuditEntry, EditEntry> | EditRun;

export class AuditRows {
  #rows: AuditDraftRow[] = [];
  #runs = new Map<string, EditRun>();

  get length(): number {
    return this.#rows.length;
  }

  opensRow(
    entry: AuditEntry
  ): boolean {
    return entry.kind !== "edit" || this.#continued(entry) === null;
  }

  add(
    entry: AuditEntry
  ): void {
    if (entry.kind !== "edit") {
      this.#rows.push(entry);

      return;
    }

    const run = this.#continued(entry);
    if (run === null) {
      this.#start(entry);
    }
    else {
      run.count++;
      run.from = entry.at;
    }
  }

  toArray(): AuditDraftRow[] {
    return [...this.#rows];
  }

  #continued(
    entry: EditEntry
  ): EditRun | null {
    const run = this.#runs.get(runKey(entry));

    return run !== undefined && run.from - entry.at < EDIT_RUN_GAP_MS ?
      run :
      null;
  }

  #start(
    entry: EditEntry
  ): void {
    const run: EditRun = {
      kind: "edit",
      actor: entry.actor,
      assetId: entry.assetId,
      count: 1,
      from: entry.at,
      to: entry.at
    };
    this.#runs.set(runKey(entry), run);
    this.#rows.push(run);
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
