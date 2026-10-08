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
    description: "List every account, its role and whether it is online",
    args: [],
    execute: async(_args, ctx) => {
      await roster.ready;
      for (const line of describe(roster)) {
        ctx.print(line);
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

  return namespace;
}

function describe(
  entries: Iterable<RosterEntry>
): string[] {
  return Array.from(
    entries,
    (entry) => `${entry.username} (${entry.role}${entry.online ? ", online" : ""})`
  );
}
