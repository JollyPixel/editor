// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import {
  ADMIN_ROLE,
  type Account,
  type AccountsRoster,
  type RosterEntry
} from "@jolly-pixel/accounts";
import {
  SubscriptionController,
  showConfirm
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  UsersTreeModel,
  parseRoleAction
} from "../../accounts/UsersTreeModel.ts";

export interface UsersErrorDetail {
  message: string;
}

@customElement("studio-users")
export class UsersPane extends LitElement {
  @property({ attribute: false })
  declare self: Account | null;

  @state()
  declare _collapsed: ReadonlySet<string>;

  @query("jolly-context-menu")
  declare _menu: HTMLElementTagNameMap["jolly-context-menu"] | null;

  #roster = new SubscriptionController<AccountsRoster>(this, (roster) => {
    const repaint = () => this.requestUpdate();
    roster.on("change", repaint);

    return [
      () => roster.off("change", repaint)
    ];
  });

  #menuTarget: RosterEntry | null = null;

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

  get #admin(): boolean {
    return this.self?.role === ADMIN_ROLE;
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override render(): TemplateResult {
    const model = this.#model();

    return html`
      <jolly-tree
        indent-guides
        .nodes=${model.nodes}
        .expanded=${this.#expanded(model)}
        @jolly-toggle-expand=${this.#onToggleExpand}
        @jolly-context-request=${this.#onContextRequest}
      ></jolly-tree>
      ${this.#admin ? html`
        <jolly-context-menu
          label="User actions"
          @jolly-context-action=${this.#onContextAction}
        ></jolly-context-menu>
      ` : nothing}
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
      this.self?.id ?? null
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
    if (
      !this.#admin ||
      this._menu === null ||
      id === null
    ) {
      return;
    }

    const model = this.#model();
    const entry = model.entry(id);
    if (entry === undefined) {
      return;
    }

    this.#menuTarget = entry;
    this._menu.items = model.menu(entry);
    this._menu.openAt(x, y);
  };

  readonly #onContextAction = (
    event: HTMLElementEventMap["jolly-context-action"]
  ): void => {
    const entry = this.#menuTarget;
    this.#menuTarget = null;
    if (entry === null) {
      return;
    }

    const role = parseRoleAction(event.detail.id);
    if (role !== null) {
      this.#run(this.#roster.attached.assignRole(entry.username, role));
    }
    else if (event.detail.id === "remove") {
      void this.#remove(entry);
    }
  };

  async #remove(
    entry: RosterEntry
  ): Promise<void> {
    const confirmed = await showConfirm({
      title: `Remove "${entry.username}"?`,
      message: "The account and its sessions will be deleted.",
      confirmLabel: "Remove",
      danger: true
    });
    if (confirmed) {
      this.#run(this.#roster.attached.remove(entry.username));
    }
  }

  #run(
    change: Promise<void>
  ): void {
    change.catch((error: unknown) => {
      const event = new CustomEvent<UsersErrorDetail>("users-error", {
        bubbles: true,
        detail: {
          message: error instanceof Error ? error.message : String(error)
        }
      });
      this.dispatchEvent(event);
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-users": UsersPane;
  }

  interface HTMLElementEventMap {
    "users-error": CustomEvent<UsersErrorDetail>;
  }
}
