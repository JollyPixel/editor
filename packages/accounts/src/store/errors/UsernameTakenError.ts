export class UsernameTakenError extends Error {
  constructor(
    username: string
  ) {
    super(`the username "${username}" is taken`);
    this.name = "UsernameTakenError";
  }
}
