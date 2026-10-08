export class AccountsRejectedError extends Error {
  constructor(
    reason: string
  ) {
    super(reason);
    this.name = "AccountsRejectedError";
  }
}
