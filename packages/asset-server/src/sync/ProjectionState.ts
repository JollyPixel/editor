// Import Third-party Dependencies
import {
  defineSchema,
  Validator
} from "ata-validator";

// Import Internal Dependencies
import type { AssetSource } from "../sources/AssetSource.ts";
import {
  readJsonFile,
  writeJsonFile
} from "../sources/jsonFile.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { PROJECTION_STATE_PATH } from "../constants.ts";

// CONSTANTS
const kStateVersion = 1;
const kValidatorOptions = { useDefaults: false };
const kRecordValidator = new Validator(
  defineSchema({ type: "object" }),
  kValidatorOptions
);
const kCheckpointValidator = new Validator(
  defineSchema({ type: "integer" }),
  kValidatorOptions
);
const kFailureValidator = new Validator(
  defineSchema({
    type: "object",
    properties: {
      eventId: { type: "integer" },
      attempts: { type: "integer" },
      reason: { type: "string" }
    },
    required: [
      "eventId",
      "attempts",
      "reason"
    ]
  }),
  kValidatorOptions
);

export interface ProjectionFailure {
  readonly eventId: number;
  readonly attempts: number;
  readonly reason: string;
}

export interface ProjectionStateParse {
  readonly data: ProjectionStateData | null;
  readonly dropped: number;
}

interface PickedEntries<TValue> {
  readonly entries: Record<string, TValue>;
  readonly dropped: number;
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
      this.#checkpoints.set(
        assetId,
        eventId
      );
    }
    for (const [assetId, failure] of Object.entries(data.failures)) {
      this.#failures.set(
        assetId,
        failure
      );
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

  static async load(
    source: AssetSource,
    logger: Logger = silentLogger()
  ): Promise<ProjectionState> {
    const { data, dropped } = ProjectionState.parse(
      await readJsonFile(
        source,
        PROJECTION_STATE_PATH
      )
    );
    if (dropped > 0) {
      logger
        .withMetadata({
          path: PROJECTION_STATE_PATH,
          dropped
        })
        .warn("projection state entries dropped");
    }

    return new ProjectionState(source, data);
  }

  static parse(
    input: unknown
  ): ProjectionStateParse {
    if (!kRecordValidator.isValidObject(input)) {
      return {
        data: null,
        dropped: 0
      };
    }

    const checkpoints = pickEntries(
      input.checkpoints,
      kCheckpointValidator
    );
    const failures = pickEntries(
      input.failures,
      kFailureValidator
    );

    return {
      data: {
        version: kStateVersion,
        checkpoints: checkpoints.entries,
        failures: failures.entries
      },
      dropped: checkpoints.dropped + failures.dropped
    };
  }
}

function pickEntries<TValue>(
  input: unknown,
  validator: Validator<TValue>
): PickedEntries<TValue> {
  if (!kRecordValidator.isValidObject(input)) {
    return {
      entries: {},
      dropped: 0
    };
  }

  const entries: Record<string, TValue> = {};
  let dropped = 0;

  for (const [key, value] of Object.entries(input)) {
    const result = validator.validate(value);
    if (result.valid) {
      entries[key] = result.data;
    }
    else {
      dropped += 1;
    }
  }

  return {
    entries,
    dropped
  };
}
