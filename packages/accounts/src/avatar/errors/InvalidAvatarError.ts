// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class InvalidAvatarError extends AccountsError {
  constructor(
    message: string,
    options?: ErrorOptions
  ) {
    super("invalid-avatar", message, options);
    this.name = "InvalidAvatarError";
  }
}
