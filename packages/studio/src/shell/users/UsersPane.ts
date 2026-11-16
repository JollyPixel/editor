// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import type {
  AccessRequest,
  Member,
  AccountsRoster,
  RosterEntry
} from "@jolly-pixel/accounts";
import "@jolly-pixel/ui/elements/context-menu";
import { showConfirm } from "@jolly-pixel/ui/elements/dialog";
import "@jolly-pixel/ui/elements/tree";

// Import Internal Dependencies
import {
  UsersTreeModel,
  parseRoleAction,
  type UsersMenuTarget
} from "../../accounts/UsersTreeModel.ts";
import {
  AGENT_CHAT_CHANGE,
  type ChatAgent,
  type StudioAgentChat
} from "../../golem/StudioAgentChat.ts";
import { ChangeController } from "../ChangeController.ts";
import { RosterController } from "../RosterController.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";

@customElement("studio-users")
export class UsersPane extends LitElement {
  static override styles = css`
    :host {
      display: block;
      padding: 0 var(--jolly-space-2) var(--jolly-space-2);
    }

    jolly-tree {
      --jolly-row-height: 26px;
      --jolly-tree-avatar-size: 18px;
      --jolly-avatar-presence-ring: var(--jolly-surface-raised);
    }

    jolly-tree::part(leaf) {
      margin-block: 1px;
      border: 1px solid var(--jolly-border);
      background: var(--jolly-surface-raised);
    }

    jolly-tree::part(leaf):hover {
      background: var(--jolly-control-bg-hover);
    }
  `;

  @property({ attribute: false })
  declare self: Member | null;

  @state()
  declare _collapsed: ReadonlySet<string>;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  #roster = new RosterController(this);
  #agentChat = new ChangeController<StudioAgentChat>(this, AGENT_CHAT_CHANGE);

  #menuTarget: UsersMenuTarget | null = null;

  constructor() {
    super();
    this.self = null;
    this._collapsed = new Set();
  }

  set roster(
    roster: AccountsRoster
  ) {
    this.#roster.attach(roster);
  }

  set agentChat(
    chat: StudioAgentChat
  ) {
    this.#agentChat.attach(chat);
  }

  override render(): TemplateResult {
    const model = this.#model();

    return html`
      <jolly-tree
        indent-guides
        toggle-style="box"
        .nodes=${model.nodes}
        .expanded=${this.#expanded(model)}
        @jolly-toggle-expand=${this.#onToggleExpand}
        @jolly-context-request=${this.#onContextRequest}
      ></jolly-tree>
      <jolly-context-menu
        label="User actions"
        @jolly-context-action=${this.#onContextAction}
      ></jolly-context-menu>
    `;
  }

  #model(): UsersTreeModel {
    const roster = this.#roster.current;
    if (roster === null) {
      return UsersTreeModel.EMPTY;
    }

    return new UsersTreeModel(
      roster.roles,
      roster,
      roster.requests,
      this.self?.id ?? null,
      this.#agentChat.current?.agents ?? []
    );
  }

  #expanded(
    model: UsersTreeModel
  ): string[] {
    return model.nodes
      .map((node) => node.id)
      .filter((id) => !this._collapsed.has(id));
  }

  readonly #onToggleExpand = (
    event: HTMLElementEventMap["jolly-toggle-expand"]
  ): void => {
    const { id, expanded } = event.detail;
    const collapsed = new Set(this._collapsed);
    if (expanded) {
      collapsed.delete(id);
    }
    else {
      collapsed.add(id);
    }
    this._collapsed = collapsed;
  };

  readonly #onContextRequest = (
    event: HTMLElementEventMap["jolly-context-request"]
  ): void => {
    const { id, x, y } = event.detail;
    const model = this.#model();
    const target = id === null ? undefined : model.target(id);
    if (this._menu === null || target === undefined) {
      return;
    }

    const items = model.menu(target);
    if (items.length === 0) {
      return;
    }

    this.#menuTarget = target;
    this._menu.items = items;
    this._menu.openAt(x, y);
  };

  readonly #onContextAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    const target = this.#menuTarget;
    this.#menuTarget = null;
    if (target?.type === "user") {
      this.#onUserAction(target.entry, event.detail.id);
    }
    else if (target?.type === "request") {
      this.#onRequestAction(target.request, event.detail.id);
    }
    else if (target?.type === "agent" && event.detail.id === "disconnect") {
      void this.#disconnect(target.agent);
    }
  };

  async #disconnect(
    agent: ChatAgent
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Disconnect "${agent.username}"?`,
      message: "It stays offline until it restarts, and its token keeps working.",
      confirmLabel: "Disconnect"
    });
    if (confirmed) {
      this.#run(this.#agentChat.attached.disconnect(agent));
    }
  }

  #onUserAction(
    entry: RosterEntry,
    actionId: string
  ): void {
    const role = parseRoleAction(actionId);
    if (role !== null) {
      this.#run(this.#roster.attached.assignRole(entry.username, role));
    }
    else if (actionId === "remove") {
      void this.#remove(entry);
    }
    else if (actionId === "transfer-ownership") {
      void this.#transferOwnership(entry);
    }
    else if (actionId === "delete-account") {
      void this.#deleteAccount(entry);
    }
  }

  #onRequestAction(
    request: AccessRequest,
    actionId: string
  ): void {
    const role = parseRoleAction(actionId);
    if (role !== null) {
      this.#run(this.#roster.attached.approve(request.username, role));
    }
    else if (actionId === "deny") {
      void this.#deny(request);
    }
  }

  async #remove(
    entry: RosterEntry
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Remove "${entry.username}" from this project?`,
      message: "Their account stays, with their other projects.",
      confirmLabel: "Remove",
      danger: true
    });
    if (confirmed) {
      this.#run(this.#roster.attached.remove(entry.username));
    }
  }

  async #transferOwnership(
    entry: RosterEntry
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Make "${entry.username}" the owner?`,
      message: "They own the server and every project, and only they can give " +
        "ownership back. You stay an admin of every project.",
      confirmLabel: "Transfer",
      danger: true
    });
    if (confirmed) {
      this.#run(this.#roster.attached.transferOwnership(entry.username));
    }
  }

  async #deleteAccount(
    entry: RosterEntry
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Delete the account "${entry.username}"?`,
      message: "It leaves every project, with its sessions, share links and agent tokens.",
      confirmLabel: "Delete",
      danger: true
    });
    if (confirmed) {
      this.#run(this.#roster.attached.deleteAccount(entry.username));
    }
  }

  async #deny(
    request: AccessRequest
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Deny "${request.username}"?`,
      message: "The request will be deleted and the username freed.",
      confirmLabel: "Deny",
      danger: true
    });
    if (confirmed) {
      this.#run(this.#roster.attached.deny(request.username));
    }
  }

  #run(
    change: Promise<void>
  ): void {
    change.catch((error: unknown) => {
      this.dispatchEvent(StudioErrorEvent.from(error));
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-users": UsersPane;
  }
}
