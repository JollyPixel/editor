// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class ShareLinkRefusedError extends AccountsError {
  constructor(
    message: string
  ) {
    super(
      "share-link-refused",
      message
    );
    this.name = "ShareLinkRefusedError";
  }
}
