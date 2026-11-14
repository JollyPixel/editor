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

// Import Internal Dependencies
import type { ChatAgent } from "../golem/StudioAgentChat.ts";

// CONSTANTS
const kRolePrefix = "role:";
const kRequestsNodeId = "requests";
const kRequestPrefix = "request:";
const kUserPrefix = "user:";
const kAgentsNodeId = "agents";
const kAgentPrefix = "agent:";
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
  }
  | {
    type: "agent";
    agent: ChatAgent;
  };

export type UsersNodeData =
  | {
    type: "role";
    role: string;
  }
  | {
    type: "requests";
  }
  | {
    type: "agents";
  }
  | UsersMenuTarget;

export type UsersTreeNode = TreeNode<UsersNodeData>;

export class UsersTreeModel {
  static readonly EMPTY = new UsersTreeModel(
    [],
    [],
    [],
    null,
    []
  );

  readonly roles: readonly string[];
  readonly nodes: UsersTreeNode[];

  #viewer: RosterEntry | null = null;
  #usernames = new Map<string, string>();
  #targets = new Map<string, UsersMenuTarget>();

  constructor(
    roles: readonly string[],
    entries: Iterable<RosterEntry>,
    requests: readonly AccessRequest[],
    selfId: string | null,
    agents: readonly ChatAgent[]
  ) {
    this.roles = roles;
    const byRole = new Map<string, RosterEntry[]>(
      roles.map((role) => [role, []])
    );
    for (const entry of entries) {
      byRole.get(entry.role)?.push(entry);
      this.#usernames.set(entry.id, entry.username);
      if (entry.id === selfId) {
        this.#viewer = entry;
      }
    }

    const roleNodes = Array.from(
      byRole,
      ([role, entries]) => this.#roleNode(role, entries)
    );
    this.nodes = [
      ...(agents.length === 0 ? [] : [this.#agentsNode(agents)]),
      ...(requests.length === 0 ? [] : [this.#requestsNode(requests)]),
      ...roleNodes
    ];
  }

  target(
    nodeId: string
  ): UsersMenuTarget | undefined {
    return this.#targets.get(nodeId);
  }

  menu(
    target: UsersMenuTarget
  ): ContextMenuEntry[] {
    if (target.type === "agent") {
      return this.#agentMenu(target.agent);
    }
    if (this.#viewer?.role !== ADMIN_ROLE) {
      return [];
    }

    return target.type === "request" ?
      this.#requestMenu() :
      this.#userMenu(target.entry);
  }

  #agentMenu(
    agent: ChatAgent
  ): ContextMenuEntry[] {
    if (!this.#ownsAgent(agent)) {
      return [];
    }

    return [{
      id: "disconnect",
      label: "Disconnect",
      icon: "sign-out"
    }];
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

  #agentsNode(
    agents: readonly ChatAgent[]
  ): UsersTreeNode {
    const sorted = agents.toSorted(
      (left, right) => this.#compareAgents(left, right)
    );

    return {
      id: kAgentsNodeId,
      label: "Agents",
      detail: String(sorted.length),
      data: {
        type: "agents"
      },
      children: sorted.map((agent) => this.#agentNode(agent))
    };
  }

  #agentNode(
    agent: ChatAgent
  ): UsersTreeNode {
    const data: UsersMenuTarget = {
      type: "agent",
      agent
    };
    const id = `${kAgentPrefix}${agent.tokenId}`;
    this.#targets.set(id, data);
    const owner = this.#ownerName(agent);
    const { activity } = agent;

    return {
      id,
      label: agent.username,
      avatar: {
        peerId: agent.tokenId,
        presence: "online"
      },
      ...(owner === null ? {} : { detail: owner }),
      ...(activity === null ? {} : {
        badges: [{
          color: agent.color,
          title: activity.label
        }]
      }),
      data
    };
  }

  #compareAgents(
    left: ChatAgent,
    right: ChatAgent
  ): number {
    return Number(this.#ownsAgent(right)) - Number(this.#ownsAgent(left)) ||
      (this.#ownerName(left) ?? "").localeCompare(this.#ownerName(right) ?? "") ||
      left.username.localeCompare(right.username);
  }

  #ownerName(
    agent: ChatAgent
  ): string | null {
    return this.#usernames.get(agent.ownerId) ?? null;
  }

  #ownsAgent(
    agent: ChatAgent
  ): boolean {
    return this.#viewer?.id === agent.ownerId;
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
    const data: UsersMenuTarget = {
      type: "user",
      entry
    };
    const id = `${kUserPrefix}${entry.id}`;
    this.#targets.set(id, data);

    return {
      id,
      label: entry.username,
      avatar: {
        peerId: entry.id,
        image: entry.avatar,
        presence: entry.online ? "online" : "offline"
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

export function roleLabel(
  role: string
): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
