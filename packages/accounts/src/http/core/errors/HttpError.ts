// CONSTANTS
export const HTTP_ERROR_CODES = [
  "cross-origin",
  "method-not-allowed",
  "length-required",
  "payload-too-large",
  "invalid-request"
] as const;

export type HttpErrorCode = typeof HTTP_ERROR_CODES[number];

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: string,
    message: string,
    headers: Record<string, string> = {}
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.headers = { ...headers };
  }
}
