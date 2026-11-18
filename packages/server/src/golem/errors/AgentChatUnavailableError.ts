export class AgentChatUnavailableError extends Error {
  constructor() {
    super("The golem chat did not answer the join.");
    this.name = "AgentChatUnavailableError";
  }
}
