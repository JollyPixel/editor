// Import Third-party Dependencies
import {
  defineSchema,
  Validator
} from "ata-validator";
import {
  writeJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { PROJECTION_STATE_PATH } from "../stateDirectory.ts";
import {
  keepValid,
  readStateFile,
  type StateFileParse,
  type ValidEntries
} from "../utils/stateFile.ts";

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

export interface ProjectionStateData {
  readonly version: 1;
  readonly checkpoints: Record<string, number>;
  readonly failures: Record<string, ProjectionFailure>;
}

/**
 * Persists each asset's last successfully projected event id.
 */
export class ProjectionState {
  #source: AssetSource;
  #checkpoints = new Map<string, number>();
  #failures = new Map<string, ProjectionFailure>();

  constructor(
    source: AssetSource,
    data: ProjectionStateData | null = null
  ) {
    this.#source = source;
    if (data === null) {
      return;
    }

    this.#checkpoints = new Map(Object.entries(data.checkpoints));
    this.#failures = new Map(Object.entries(data.failures));
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
      checkpoints: sortedRecord(this.#checkpoints),
      failures: sortedRecord(this.#failures)
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
    const data = await readStateFile(
      source,
      PROJECTION_STATE_PATH,
      ProjectionState.parse,
      logger
    );

    return new ProjectionState(source, data);
  }

  static parse(
    input: unknown
  ): StateFileParse<ProjectionStateData | null> {
    if (!kRecordValidator.isValidObject(input)) {
      return {
        data: null,
        dropped: 0
      };
    }

    const checkpoints = validRecord(
      input.checkpoints,
      kCheckpointValidator
    );
    const failures = validRecord(
      input.failures,
      kFailureValidator
    );

    return {
      data: {
        version: kStateVersion,
        checkpoints: Object.fromEntries(checkpoints.entries),
        failures: Object.fromEntries(failures.entries)
      },
      dropped: checkpoints.dropped + failures.dropped
    };
  }
}

function validRecord<TValue>(
  input: unknown,
  validator: Validator<TValue>
): ValidEntries<string, TValue> {
  if (!kRecordValidator.isValidObject(input)) {
    return {
      entries: [],
      dropped: 0
    };
  }

  return keepValid(Object.entries(input), validator);
}

function sortedRecord<TValue>(
  map: Map<string, TValue>
): Record<string, TValue> {
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  );
}
