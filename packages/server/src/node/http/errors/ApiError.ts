// Import Internal Dependencies
import type { ApiFailureCode } from "../../../http/api.ts";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiFailureCode;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: ApiFailureCode,
    message: string,
    headers: Record<string, string> = {}
  ) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.headers = {
      ...headers
    };
  }
}
