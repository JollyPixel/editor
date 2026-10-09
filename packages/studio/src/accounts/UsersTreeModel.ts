// Import Third-party Dependencies
import {
  ADMIN_ROLE,
  type AccessRequest,
  type RosterEntry
} from "@jolly-pixel/accounts";
import type {
  ContextMenuEntry,
  TreeBadge,
  TreeNode
} from "@jolly-pixel/ui";
import { peerProfileColor } from "@jolly-pixel/ui/network";

// CONSTANTS
const kRolePrefix = "role:";
const kRequestsNodeId = "requests";
const kRequestPrefix = "request:";
const kUserPrefix = "user:";
const kOfflineOpacity = "30%";
const kOwnerBadge: TreeBadge = {
  color: "#e3a21a",
  title: "Owner",
  icon: "crown"
};

export type UsersMenuTarget =
  | {
    type: "user";
    entry: RosterEntry;
  }
  | {
    type: "request";
    request: AccessRequest;
  };

export type UsersNodeData =
  | {
    type: "role";
    role: string;
  }
  | {
    type: "requests";
  }
  | UsersMenuTarget;

export type UsersTreeNode = TreeNode<UsersNodeData>;

export class UsersTreeModel {
  static readonly EMPTY = new UsersTreeModel(
    [],
    [],
    [],
    null
  );

  readonly roles: readonly string[];
  readonly nodes: UsersTreeNode[];

  #viewer: RosterEntry | null = null;
  #targets = new Map<string, UsersMenuTarget>();

  constructor(
    roles: readonly string[],
    entries: Iterable<RosterEntry>,
    requests: readonly AccessRequest[],
    selfId: string | null
  ) {
    this.roles = roles;
    const byRole = new Map<string, RosterEntry[]>(
      roles.map((role) => [role, []])
    );
    for (const entry of entries) {
      byRole.get(entry.role)?.push(entry);
      if (entry.id === selfId) {
        this.#viewer = entry;
      }
    }

    const roleNodes = Array.from(
      byRole,
      ([role, entries]) => this.#roleNode(role, entries)
    );
    this.nodes = requests.length === 0 ?
      roleNodes :
      [this.#requestsNode(requests), ...roleNodes];
  }

  get viewerIsAdmin(): boolean {
    return this.#viewer?.role === ADMIN_ROLE;
  }

  target(
    nodeId: string
  ): UsersMenuTarget | undefined {
    return this.#targets.get(nodeId);
  }

  menu(
    target: UsersMenuTarget
  ): ContextMenuEntry[] {
    return target.type === "request" ?
      this.#requestMenu() :
      this.#userMenu(target.entry);
  }

  #userMenu(
    entry: RosterEntry
  ): ContextMenuEntry[] {
    const transfer: ContextMenuEntry[] = this.#viewer?.owner === true && !entry.owner ?
      [{
        id: "transfer-ownership",
        label: "Transfer ownership",
        icon: "crown"
      }] :
      [];

    return [
      {
        id: "role",
        label: "Role",
        disabled: entry.owner,
        items: this.roles.map((role) => {
          return {
            id: `${kRolePrefix}${role}`,
            label: roleLabel(role),
            disabled: role === entry.role
          };
        })
      },
      "separator",
      ...transfer,
      {
        id: "remove",
        label: "Remove account",
        icon: "trash",
        intent: "danger",
        disabled: entry.owner || this.#isViewer(entry)
      }
    ];
  }

  #requestMenu(): ContextMenuEntry[] {
    return [
      {
        id: "approve",
        label: "Approve as",
        items: this.roles.map((role) => {
          return {
            id: `${kRolePrefix}${role}`,
            label: roleLabel(role)
          };
        })
      },
      "separator",
      {
        id: "deny",
        label: "Deny request",
        icon: "trash",
        intent: "danger"
      }
    ];
  }

  #requestsNode(
    requests: readonly AccessRequest[]
  ): UsersTreeNode {
    return {
      id: kRequestsNodeId,
      label: "Access requests",
      detail: String(requests.length),
      data: {
        type: "requests"
      },
      children: requests.map((request) => this.#requestNode(request))
    };
  }

  #requestNode(
    request: AccessRequest
  ): UsersTreeNode {
    const data: UsersMenuTarget = {
      type: "request",
      request
    };
    const id = `${kRequestPrefix}${request.id}`;
    this.#targets.set(id, data);

    return {
      id,
      label: request.username,
      avatar: {
        peerId: request.id
      },
      data
    };
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
    const data: UsersMenuTarget = {
      type: "user",
      entry
    };
    const id = `${kUserPrefix}${entry.id}`;
    this.#targets.set(id, data);

    return {
      id,
      label: entry.username,
      ...(this.#isViewer(entry) ? { detail: "you" } : {}),
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
      ...(entry.owner ? { badges: [kOwnerBadge] } : {}),
      data
    };
  }

  #isViewer(
    entry: RosterEntry
  ): boolean {
    return entry.id === this.#viewer?.id;
  }
}

export function parseRoleAction(
  actionId: string
): string | null {
  return actionId.startsWith(kRolePrefix) ?
    actionId.slice(kRolePrefix.length) :
    null;
}

function roleLabel(
  role: string
): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
