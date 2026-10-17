// Import Third-party Dependencies
import {
  MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";
import * as z from "zod";

// Import Internal Dependencies
import {
  ACCOUNTS_APPLIED,
  ACCOUNTS_APPROVE,
  ACCOUNTS_ASSIGN_ROLE,
  ACCOUNTS_DENY,
  ACCOUNTS_REJECTED,
  ACCOUNTS_REMOVE,
  ACCOUNTS_ROSTER,
  ACCOUNTS_TRANSFER_OWNERSHIP
} from "./protocol.ts";

// CONSTANTS
const kRosterEntrySchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  owner: z.boolean(),
  avatar: z.optional(z.string()),
  online: z.boolean()
});
const kAccessRequestSchema = z.object({
  id: z.string(),
  username: z.string()
});

export const accountsCommandProtocol = new MessageProtocol(
  z.union([
    z.object({
      type: z.literal(ACCOUNTS_ASSIGN_ROLE),
      requestId: z.string(),
      username: z.string(),
      role: z.string()
    }),
    z.object({
      type: z.literal(ACCOUNTS_APPROVE),
      requestId: z.string(),
      username: z.string(),
      role: z.string()
    }),
    z.object({
      type: z.literal(ACCOUNTS_DENY),
      requestId: z.string(),
      username: z.string()
    }),
    z.object({
      type: z.literal(ACCOUNTS_REMOVE),
      requestId: z.string(),
      username: z.string()
    }),
    z.object({
      type: z.literal(ACCOUNTS_TRANSFER_OWNERSHIP),
      requestId: z.string(),
      username: z.string()
    })
  ]),
  {
    discriminator: "type"
  }
);

export const accountsMessageProtocol = new MessageProtocol(
  z.union([
    z.object({
      type: z.literal(ACCOUNTS_ROSTER),
      roles: z.array(z.string()),
      accounts: z.array(kRosterEntrySchema),
      requests: z.array(kAccessRequestSchema)
    }),
    z.object({
      type: z.literal(ACCOUNTS_APPLIED),
      requestId: z.string()
    }),
    z.object({
      type: z.literal(ACCOUNTS_REJECTED),
      requestId: z.string(),
      reason: z.string()
    })
  ]),
  {
    discriminator: "type"
  }
);

export const accountsProtocols: MessageProtocols = {
  inbound: accountsCommandProtocol,
  outbound: accountsMessageProtocol
};
