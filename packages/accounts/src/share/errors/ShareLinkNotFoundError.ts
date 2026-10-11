// Import Internal Dependencies
import { AccountsError } from "../../account/errors/AccountsError.ts";

export class ShareLinkNotFoundError extends AccountsError {
  constructor() {
    super(
      "share-link-not-found",
      "no share link has this id"
    );
    this.name = "ShareLinkNotFoundError";
  }
}
