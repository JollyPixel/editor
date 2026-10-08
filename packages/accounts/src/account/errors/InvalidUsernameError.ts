export class InvalidUsernameError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "InvalidUsernameError";
  }
}
