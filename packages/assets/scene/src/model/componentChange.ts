// Import Internal Dependencies
import type { JSONObject } from "../network/types.ts";

export interface ComponentChange {
  data?: JSONObject;
  /**
   * Top-level fields removed from the data.
   */
  unset?: Iterable<string>;
}

export function applyComponentChange(
  data: Readonly<JSONObject>,
  change: ComponentChange
): JSONObject {
  const changed: JSONObject = {
    ...data,
    ...structuredClone(change.data)
  };
  for (const key of change.unset ?? []) {
    delete changed[key];
  }

  return changed;
}
