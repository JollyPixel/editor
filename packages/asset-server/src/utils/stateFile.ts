// Import Third-party Dependencies
import type {
  Infer,
  Schema,
  SchemaParser
} from "@jolly-pixel/network";
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

export function keepValid<TKey, const TSchema extends Schema>(
  entries: Iterable<[TKey, unknown]>,
  parser: SchemaParser<TSchema>
): ValidEntries<TKey, Infer<TSchema>> {
  const kept: [TKey, Infer<TSchema>][] = [];
  let dropped = 0;

  for (const [key, value] of entries) {
    const result = parser.parse(value);
    if (result.ok) {
      kept.push([key, result.val]);
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
