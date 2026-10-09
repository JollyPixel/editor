// Import Third-party Dependencies
import type {
  AccountsRoster,
  RosterEntry
} from "@jolly-pixel/accounts";
import type { EditorConsole } from "@jolly-pixel/editor.host";

// CONSTANTS
export const USERS_NAMESPACE = "users";

type Commands = EditorConsole["commands"];
type Namespace = ReturnType<Commands["registerNamespace"]>;

export function usersConsole(
  commands: Commands,
  roster: AccountsRoster
): Namespace {
  const namespace = commands.registerNamespace(USERS_NAMESPACE, {
    description: "Studio accounts, for admins"
  });

  namespace.registerCommand("list", {
    description: "List every account, its role and whether it is online, then the access requests",
    args: [],
    execute: async(_args, ctx) => {
      await roster.ready;
      for (const line of describe(roster)) {
        ctx.print(line);
      }
      for (const request of roster.requests) {
        ctx.print(`${request.username} (access request)`);
      }
    }
  });

  namespace.registerCommand("role", {
    description: "Give an account a role, applied on its next connection",
    args: [
      {
        name: "user",
        type: "string",
        required: true
      },
      {
        name: "role",
        type: "string",
        required: true
      }
    ],
    execute: async({ user, role }, ctx) => {
      await roster.assignRole(user, role);
      ctx.print(`${user} is now ${role}`);
    }
  });

  namespace.registerCommand("approve", {
    description: "Approve an access request with a role",
    args: [
      {
        name: "user",
        type: "string",
        required: true
      },
      {
        name: "role",
        type: "string",
        required: true
      }
    ],
    execute: async({ user, role }, ctx) => {
      await roster.approve(user, role);
      ctx.print(`${user} joined as ${role}`);
    }
  });

  namespace.registerCommand("deny", {
    description: "Delete an access request and free its username",
    args: [
      {
        name: "user",
        type: "string",
        required: true
      }
    ],
    execute: async({ user }, ctx) => {
      await roster.deny(user);
      ctx.print(`${user} denied`);
    }
  });

  namespace.registerCommand("remove", {
    description: "Delete an account and its sign-in sessions",
    args: [
      {
        name: "user",
        type: "string",
        required: true
      }
    ],
    execute: async({ user }, ctx) => {
      await roster.remove(user);
      ctx.print(`${user} removed`);
    }
  });

  namespace.registerCommand("transfer", {
    description: "Make another account the owner, for the owner only; you stay an admin",
    args: [
      {
        name: "user",
        type: "string",
        required: true
      }
    ],
    execute: async({ user }, ctx) => {
      await roster.transferOwnership(user);
      ctx.print(`${user} is now the owner`);
    }
  });

  return namespace;
}

function describe(
  entries: Iterable<RosterEntry>
): string[] {
  return Array.from(entries, (entry) => {
    const traits = [
      entry.role,
      ...(entry.owner ? ["owner"] : []),
      ...(entry.online ? ["online"] : [])
    ];

    return `${entry.username} (${traits.join(", ")})`;
  });
}
