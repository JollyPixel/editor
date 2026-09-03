// Import Internal Dependencies
import type {
  MonitorKey,
  MonitorOptions
} from "./Monitor.ts";

export type MonitorFields<TObject extends object> = Partial<{
  [TKey in MonitorKey<TObject>]: MonitorOptions<TObject[TKey]>;
}>;

type MonitorFieldEntry<TObject extends object> = [
  MonitorKey<TObject>,
  MonitorOptions<TObject[MonitorKey<TObject>]>
];

export function monitorFieldEntries<TObject extends object>(
  fields: MonitorFields<TObject>
): MonitorFieldEntry<TObject>[] {
  const entries: MonitorFieldEntry<TObject>[] = [];
  for (const [key, options] of Object.entries(fields)) {
    if (options !== undefined) {
      entries.push([
        key as MonitorKey<TObject>,
        options as MonitorOptions<TObject[MonitorKey<TObject>]>
      ]);
    }
  }

  return entries;
}
