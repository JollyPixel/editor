export class NotAnAgentTokenError extends Error {
  constructor() {
    super(
      "The bridge needs an agent token: create one on the studio's Agents page."
    );
    this.name = "NotAnAgentTokenError";
  }
}
