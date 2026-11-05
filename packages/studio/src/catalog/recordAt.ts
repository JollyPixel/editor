// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";

export function recordAt(
  records: Iterable<AssetRecordData>,
  path: string
): AssetRecordData | null {
  const wanted = path.toLowerCase();
  for (const record of records) {
    if (record.path.toLowerCase() === wanted) {
      return record;
    }
  }

  return null;
}
