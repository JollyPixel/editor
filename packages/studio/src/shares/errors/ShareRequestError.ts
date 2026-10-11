export class ShareRequestError extends Error {
  readonly status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);
    this.name = "ShareRequestError";
    this.status = status;
  }
}
