// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  readJsonFile,
  writeJsonFile
} from "../sources/jsonFile.ts";
import { PROJECTION_STATE_PATH } from "../constants.ts";

// CONSTANTS
const kStateVersion = 1;

export interface ProjectionFailure {
  readonly eventId: number;
  readonly attempts: number;
  readonly reason: string;
}

export interface ProjectionStateData {
  readonly version: 1;
  readonly checkpoints: Record<string, number>;
  readonly failures: Record<string, ProjectionFailure>;
}

/**
 * Persists each asset's last successfully projected event id.
 */
export class ProjectionState {
  #checkpoints = new Map<string, number>();
  #failures = new Map<string, ProjectionFailure>();
  #source: AssetSource;

  constructor(
    source: AssetSource,
    data: ProjectionStateData | null = null
  ) {
    this.#source = source;
    if (data === null) {
      return;
    }

    for (const [assetId, eventId] of Object.entries(data.checkpoints)) {
      this.#checkpoints.set(assetId, eventId);
    }
    for (const [assetId, failure] of Object.entries(data.failures)) {
      this.#failures.set(assetId, failure);
    }
  }

  checkpoint(
    assetId: string
  ): number {
    return this.#checkpoints.get(assetId) ?? 0;
  }

  failure(
    assetId: string
  ): ProjectionFailure | undefined {
    return this.#failures.get(assetId);
  }

  advance(
    assetId: string,
    eventId: number
  ): void {
    this.#checkpoints.set(assetId, eventId);
    this.#failures.delete(assetId);
  }

  recordFailure(
    assetId: string,
    eventId: number,
    reason: string
  ): void {
    const previous = this.#failures.get(assetId);
    this.#failures.set(assetId, {
      eventId,
      attempts: previous?.eventId === eventId ? previous.attempts + 1 : 1,
      reason
    });
  }

  forget(
    assetId: string
  ): void {
    this.#checkpoints.delete(assetId);
    this.#failures.delete(assetId);
  }

  toJSON(): ProjectionStateData {
    return {
      version: kStateVersion,
      checkpoints: Object.fromEntries(
        [...this.#checkpoints.entries()].sort(
          ([a], [b]) => a.localeCompare(b)
        )
      ),
      failures: Object.fromEntries(
        [...this.#failures.entries()].sort(
          ([a], [b]) => a.localeCompare(b)
        )
      )
    };
  }

  save(): Promise<void> {
    return writeJsonFile(
      this.#source,
      PROJECTION_STATE_PATH,
      this.toJSON()
    );
  }

  /**
   * A missing or malformed file yields empty positions: the projector then
   * repairs the projection from the log instead of failing to start.
   */
  static async load(
    source: AssetSource
  ): Promise<ProjectionState> {
    return new ProjectionState(
      source,
      ProjectionState.parse(
        await readJsonFile(
          source,
          PROJECTION_STATE_PATH
        )
      )
    );
  }

  /**
   * Drops malformed checkpoints so the projector safely repeats their writes.
   */
  static parse(
    input: unknown
  ): ProjectionStateData | null {
    if (!isRecord(input)) {
      return null;
    }

    return {
      version: kStateVersion,
      checkpoints: pickEntries(
        input.checkpoints,
        (value): value is number => Number.isInteger(value)
      ),
      failures: pickEntries(input.failures, isProjectionFailure)
    };
  }
}

function isRecord(
  input: unknown
): input is Record<string, unknown> {
  return typeof input === "object" && input !== null;
}

function isProjectionFailure(
  input: unknown
): input is ProjectionFailure {
  return isRecord(input) &&
    Number.isInteger(input.eventId) &&
    Number.isInteger(input.attempts) &&
    typeof input.reason === "string";
}

function pickEntries<TValue>(
  input: unknown,
  isValid: (value: unknown) => value is TValue
): Record<string, TValue> {
  if (!isRecord(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, TValue] => isValid(entry[1])
    )
  );
}
