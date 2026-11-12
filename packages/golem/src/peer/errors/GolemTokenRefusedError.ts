export class GolemTokenRefusedError extends Error {
  constructor() {
    super("The studio refused the agent token: it is unknown or revoked.");
    this.name = "GolemTokenRefusedError";
  }
}
