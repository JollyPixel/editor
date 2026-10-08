// Import Third-party Dependencies
import type { RosterEntry } from "@jolly-pixel/accounts";
import type {
  ContextMenuEntry,
  TreeNode
} from "@jolly-pixel/ui";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// CONSTANTS
const kRolePrefix = "role:";
const kUserPrefix = "user:";
const kOfflineOpacity = "30%";

export type UsersNodeData =
  | {
    type: "role";
    role: string;
  }
  | {
    type: "user";
    entry: RosterEntry;
  };

export type UsersTreeNode = TreeNode<UsersNodeData>;

export class UsersTreeModel {
  static readonly EMPTY = new UsersTreeModel(
    [],
    [],
    null
  );

  readonly roles: readonly string[];
  readonly nodes: UsersTreeNode[];
  readonly selfId: string | null;

  #users = new Map<string, RosterEntry>();

  constructor(
    roles: readonly string[],
    entries: Iterable<RosterEntry>,
    selfId: string | null
  ) {
    this.roles = roles;
    this.selfId = selfId;
    const byRole = new Map<string, RosterEntry[]>(
      roles.map((role) => [role, []])
    );
    for (const entry of entries) {
      this.#users.set(userNodeId(entry.id), entry);
      byRole.get(entry.role)?.push(entry);
    }

    this.nodes = Array.from(
      byRole,
      ([role, entries]) => this.#roleNode(role, entries)
    );
  }

  entry(
    nodeId: string
  ): RosterEntry | undefined {
    return this.#users.get(nodeId);
  }

  menu(
    entry: RosterEntry
  ): ContextMenuEntry[] {
    return [
      {
        id: "role",
        label: "Role",
        items: this.roles.map((role) => {
          return {
            id: `${kRolePrefix}${role}`,
            label: roleLabel(role),
            disabled: role === entry.role
          };
        })
      },
      "separator",
      {
        id: "remove",
        label: "Remove account",
        icon: "trash",
        intent: "danger",
        disabled: entry.id === this.selfId
      }
    ];
  }

  #roleNode(
    role: string,
    entries: readonly RosterEntry[]
  ): UsersTreeNode {
    const online = entries.filter((entry) => entry.online).length;

    return {
      id: `${kRolePrefix}${role}`,
      label: roleLabel(role),
      detail: `${online}/${entries.length}`,
      data: {
        type: "role",
        role
      },
      children: entries.map((entry) => this.#userNode(entry))
    };
  }

  #userNode(
    entry: RosterEntry
  ): UsersTreeNode {
    const color = peerProfileColor(entry.id, { peerId: entry.id });

    return {
      id: userNodeId(entry.id),
      label: entry.username,
      ...(entry.id === this.selfId ? { detail: "you" } : {}),
      avatar: {
        peerId: entry.id,
        image: entry.avatar
      },
      swatch: {
        title: entry.online ? "Online" : "Offline",
        color: entry.online ?
          color :
          `color-mix(in srgb, ${color} ${kOfflineOpacity}, transparent)`
      },
      data: {
        type: "user",
        entry
      }
    };
  }
}

export function parseRoleAction(
  actionId: string
): string | null {
  return actionId.startsWith(kRolePrefix) ?
    actionId.slice(kRolePrefix.length) :
    null;
}

function userNodeId(
  accountId: string
): string {
  return `${kUserPrefix}${accountId}`;
}

function roleLabel(
  role: string
): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
