export class EventLogClosedError extends Error {
  constructor(
    options?: ErrorOptions
  ) {
    super("event log is closed", options);
    this.name = "EventLogClosedError";
  }
}
