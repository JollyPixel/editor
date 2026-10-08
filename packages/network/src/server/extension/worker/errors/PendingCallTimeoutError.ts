export class PendingCallTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingCallTimeoutError";
  }
}
