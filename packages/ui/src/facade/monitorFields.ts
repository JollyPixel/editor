// Import Internal Dependencies
import type {
  MonitorKey,
  MonitorOptions
} from "./Monitor.ts";

export type MonitorFields<TObject extends object> = Partial<{
  [TKey in MonitorKey<TObject>]: MonitorOptions;
}>;

export function monitorFieldEntries<TObject extends object>(
  fields: MonitorFields<TObject>
): Array<[MonitorKey<TObject>, MonitorOptions]> {
  const entries: Array<[MonitorKey<TObject>, MonitorOptions]> = [];
  for (const [key, options] of Object.entries(fields)) {
    if (options !== undefined) {
      entries.push([
        key as MonitorKey<TObject>,
        options as MonitorOptions
      ]);
    }
  }

  return entries;
}
