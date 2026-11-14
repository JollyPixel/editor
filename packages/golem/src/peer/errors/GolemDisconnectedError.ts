export class GolemDisconnectedError extends Error {
  constructor() {
    super(
      "The owner disconnected this agent. Its token still works: " +
      "restart the agent to connect again."
    );
    this.name = "GolemDisconnectedError";
  }
}
