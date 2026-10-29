// Import Internal Dependencies
import type { DeepReadonly } from "../network/types.ts";

export function ownedCopy<T>(
  view: DeepReadonly<NoInfer<T>>
): T {
  return structuredClone(view) as T;
}
