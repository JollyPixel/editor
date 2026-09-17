// Import Third-party Dependencies
import type { Validator } from "ata-validator";
import {
  readJsonFile,
  type AssetSource
} from "@jolly-pixel/asset-source";

// Import Internal Dependencies
import type { Logger } from "../logger.ts";

export interface StateFileParse<TData> {
  readonly data: TData;
  readonly dropped: number;
}

export interface ValidEntries<TKey, TValue> {
  readonly entries: [TKey, TValue][];
  readonly dropped: number;
}

export async function readStateFile<TData>(
  source: AssetSource,
  path: string,
  parse: (input: unknown) => StateFileParse<TData>,
  logger: Logger
): Promise<TData> {
  const { data, dropped } = parse(
    await readJsonFile(source, path)
  );
  if (dropped > 0) {
    logger
      .withMetadata({
        path,
        dropped
      })
      .warn("state file entries dropped");
  }

  return data;
}

export function keepValid<TKey, TValue>(
  entries: Iterable<[TKey, unknown]>,
  validator: Validator<TValue>
): ValidEntries<TKey, TValue> {
  const kept: [TKey, TValue][] = [];
  let dropped = 0;

  for (const [key, value] of entries) {
    const result = validator.validate(value);
    if (result.valid) {
      kept.push([key, result.data]);
    }
    else {
      dropped += 1;
    }
  }

  return {
    entries: kept,
    dropped
  };
}
