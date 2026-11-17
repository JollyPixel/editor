export class IntentInputError extends Error {
  constructor(
    reason: string
  ) {
    super(`The intent input is invalid:\n${reason}`);
    this.name = "IntentInputError";
  }
}
