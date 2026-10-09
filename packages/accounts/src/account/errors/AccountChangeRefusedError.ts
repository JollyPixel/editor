export class AccountChangeRefusedError extends Error {
  constructor(
    message: string
  ) {
    super(message);
    this.name = "AccountChangeRefusedError";
  }
}
