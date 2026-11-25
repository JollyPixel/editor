// Import Internal Dependencies
import type { Right } from "./types.ts";

export interface QuerySet {
  has(
    event: string
  ): boolean;
}

export function permits(
  right: Right,
  event: string,
  queries: QuerySet
): boolean {
  return right === "write" || (right === "read" && queries.has(event));
}
