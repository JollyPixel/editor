export class AgentChatRefusedError extends Error {
  constructor(
    reason: string
  ) {
    super(`The studio refused the chat message: ${reason}`);
    this.name = "AgentChatRefusedError";
  }
}
