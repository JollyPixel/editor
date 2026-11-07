// Import Internal Dependencies
import { asError } from "./error.ts";

export function throwFailures(
  failures: unknown[]
): void {
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, "Teardown failed.");
  }
}

export function throwWithFailures(
  error: unknown,
  failures: unknown[]
): never {
  if (failures.length === 0) {
    throw error;
  }

  throw new AggregateError(
    [error, ...failures],
    asError(error).message
  );
}
