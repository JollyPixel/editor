export class RemoteCancelledError extends Error {
  constructor(
    label: string
  ) {
    super(`${label} was cancelled`);

    this.name = "RemoteCancelledError";
  }
}
