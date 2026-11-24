// Import Third-party Dependencies
import type { Account } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { ProjectRightRefusedError } from "../../project/errors/ProjectRightRefusedError.ts";

export type ServerOwnerAction =
  | "creates"
  | "imports"
  | "renames"
  | "deletes";

export function requireServerOwner(
  account: Account,
  action: ServerOwnerAction
): void {
  if (!account.owner) {
    throw new ProjectRightRefusedError(
      `only the server owner ${action} projects`
    );
  }
}
