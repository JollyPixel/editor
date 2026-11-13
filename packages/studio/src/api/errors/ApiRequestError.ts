// Import Third-party Dependencies
import type { ApiFailureCode } from "@jolly-pixel/server";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ApiFailureCode | null;

  constructor(
    status: number,
    message: string,
    code: ApiFailureCode | null = null
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}
