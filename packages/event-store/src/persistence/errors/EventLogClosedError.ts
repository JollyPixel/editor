/**
 * Thrown by every backend when a log is used after `close()`.
 */
export class EventLogClosedError extends Error {
  constructor(
    options?: ErrorOptions
  ) {
    super("event log is closed", options);
  }
}
