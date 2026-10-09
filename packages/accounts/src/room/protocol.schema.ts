// Import Third-party Dependencies
import {
  MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  ACCOUNTS_APPLIED,
  ACCOUNTS_APPROVE,
  ACCOUNTS_ASSIGN_ROLE,
  ACCOUNTS_DENY,
  ACCOUNTS_REJECTED,
  ACCOUNTS_REMOVE,
  ACCOUNTS_ROSTER
} from "./protocol.ts";

// CONSTANTS
const kString = { type: "string" } as const;
const kRosterEntrySchema = {
  type: "object",
  properties: {
    id: kString,
    username: kString,
    role: kString,
    avatar: kString,
    online: { type: "boolean" }
  },
  required: [
    "id",
    "username",
    "role",
    "online"
  ]
} as const;
const kAccessRequestSchema = {
  type: "object",
  properties: {
    id: kString,
    username: kString
  },
  required: [
    "id",
    "username"
  ]
} as const;

export const accountsCommandProtocol = new MessageProtocol(
  {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_ASSIGN_ROLE },
          requestId: kString,
          username: kString,
          role: kString
        },
        required: [
          "type",
          "requestId",
          "username",
          "role"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_APPROVE },
          requestId: kString,
          username: kString,
          role: kString
        },
        required: [
          "type",
          "requestId",
          "username",
          "role"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_DENY },
          requestId: kString,
          username: kString
        },
        required: [
          "type",
          "requestId",
          "username"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_REMOVE },
          requestId: kString,
          username: kString
        },
        required: [
          "type",
          "requestId",
          "username"
        ]
      }
    ]
  },
  {
    discriminator: "type"
  }
);

export const accountsMessageProtocol = new MessageProtocol(
  {
    oneOf: [
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_ROSTER },
          roles: {
            type: "array",
            items: kString
          },
          accounts: {
            type: "array",
            items: kRosterEntrySchema
          },
          requests: {
            type: "array",
            items: kAccessRequestSchema
          }
        },
        required: [
          "type",
          "roles",
          "accounts",
          "requests"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_APPLIED },
          requestId: kString
        },
        required: [
          "type",
          "requestId"
        ]
      },
      {
        type: "object",
        properties: {
          type: { const: ACCOUNTS_REJECTED },
          requestId: kString,
          reason: kString
        },
        required: [
          "type",
          "requestId",
          "reason"
        ]
      }
    ]
  },
  {
    discriminator: "type"
  }
);

export const accountsProtocols: MessageProtocols = {
  inbound: accountsCommandProtocol,
  outbound: accountsMessageProtocol
};
