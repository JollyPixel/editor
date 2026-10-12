export class ApiRequestError extends Error {
  readonly status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}
