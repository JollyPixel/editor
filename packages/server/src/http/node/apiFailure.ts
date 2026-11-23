// Import Internal Dependencies
import { ApiError } from "./errors/ApiError.ts";
import type { DomainFailure } from "../api.ts";

// CONSTANTS
const kPayloadTooLarge = 413;

export type DomainFailures = (error: Error) => ApiError | null;

export interface FrameworkError extends Error {
  statusCode?: number;
}

export function domainFailures(
  table: readonly DomainFailure[]
): DomainFailures {
  return (error) => {
    const failure = table.find(([type]) => error instanceof type);
    if (failure === undefined) {
      return null;
    }
    const [, status, code] = failure;

    return new ApiError(status, code, error.message);
  };
}

export function apiFailure(
  error: FrameworkError,
  failures: readonly DomainFailures[]
): ApiError | null {
  if (error instanceof ApiError) {
    return error;
  }
  for (const failure of failures) {
    const mapped = failure(error);
    if (mapped !== null) {
      return mapped;
    }
  }
  if (error.statusCode === kPayloadTooLarge) {
    return new ApiError(
      kPayloadTooLarge,
      "payload-too-large",
      "the request body is too large"
    );
  }
  if (
    error.statusCode !== undefined &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return new ApiError(
      error.statusCode,
      "invalid-request",
      "the request is malformed"
    );
  }

  return null;
}
