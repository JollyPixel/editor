export class RemoteValueMissingError extends Error {
  constructor(
    address: string
  ) {
    super(`${address} has no value from the remote console`);

    this.name = "RemoteValueMissingError";
  }
}
