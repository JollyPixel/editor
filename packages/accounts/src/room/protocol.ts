// Import Third-party Dependencies
import type { InferMessage } from "@jolly-pixel/network";
import type { DistributiveOmit } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  accountsCommandProtocol,
  accountsMessageProtocol
} from "./protocol.schema.ts";

// CONSTANTS
export const ACCOUNTS_ROOM = "accounts";

export const ACCOUNTS_ASSIGN_ROLE = "accounts:assign-role";
export const ACCOUNTS_APPROVE = "accounts:approve";
export const ACCOUNTS_DENY = "accounts:deny";
export const ACCOUNTS_REMOVE = "accounts:remove";
export const ACCOUNTS_TRANSFER_OWNERSHIP = "accounts:transfer-ownership";
export const ACCOUNTS_ROSTER = "accounts:roster";
export const ACCOUNTS_APPLIED = "accounts:applied";
export const ACCOUNTS_REJECTED = "accounts:rejected";

export type AccountsCommand = InferMessage<typeof accountsCommandProtocol>;
export type AccountsRequest = DistributiveOmit<AccountsCommand, "requestId">;
export type AccountsMessage = InferMessage<typeof accountsMessageProtocol>;
export type AccountsRosterMessage = Extract<
  AccountsMessage,
  { type: typeof ACCOUNTS_ROSTER; }
>;
export type RosterEntry = AccountsRosterMessage["accounts"][number];
