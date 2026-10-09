// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  createRef,
  ref
} from "lit/directives/ref.js";
import {
  PopoverController,
  SubscriptionController
} from "@jolly-pixel/ui";
import {
  EMPTY_HISTORY_STATE,
  type HistoryScopeState,
  type HistoryStepInfo
} from "@jolly-pixel/history";

// Import Internal Dependencies
import "./historyIcons.ts";
import type { PresenceStore } from "../../state/index.ts";
import {
  historyShortcutLabel,
  type HistoryAction
} from "./historyShortcuts.ts";
import { describeRefusal } from "./describeRefusal.ts";
import type { ActiveHistory } from "./ActiveHistory.ts";

export interface HistoryWorkspace {
  activeHistory: ActiveHistory;
  presence: PresenceStore;
}

export class HistoryButtons extends LitElement {
  static override styles = css`
    :host {
      display: inline-flex;
      gap: var(--jolly-space-1, 4px);
      align-items: center;
    }

    .action {
      position: relative;
      display: inline-flex;
    }

    .count {
      position: absolute;
      right: -3px;
      bottom: -3px;
      box-sizing: border-box;
      min-width: 12px;
      height: 12px;
      padding: 0 2px;
      border-radius: 6px;
      background: var(--jolly-accent, #ffad72);
      color: var(--jolly-surface, #1e1f22);
      font-size: 8px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      line-height: 12px;
      text-align: center;
      pointer-events: none;
    }

    .count.refused {
      background: var(--jolly-danger, #e5484d);
    }

    .steps {
      position: fixed;
      inset: auto;
      box-sizing: border-box;
      width: max-content;
      max-inline-size: min(20rem, calc(100vw - 2rem));
      margin: 0;
      padding: var(--jolly-space-1, 4px) var(--jolly-space-2, 8px);
      border: 1px solid var(--jolly-border, #3a3b3f);
      border-radius: var(--jolly-radius, 4px);
      background: var(--jolly-surface, #1e1f22);
      color: var(--jolly-text, inherit);
      font-size: var(--jolly-font-size, 11px);
    }

    .steps ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .steps li {
      padding-block: 2px;
    }

    .reason {
      color: var(--jolly-text-muted, inherit);
    }
  `;

  static override properties = {
    workspace: { attribute: false },
    _state: { state: true },
    _target: { state: true }
  };

  declare workspace: HistoryWorkspace | null;
  declare private _state: HistoryScopeState;
  declare private _target: string | null;

  #marker = createRef<HTMLElement>();
  #steps = createRef<HTMLElement>();
  #popup = new PopoverController(this, {
    anchor: () => this.#marker.value ?? null,
    popover: () => this.#steps.value ?? null,
    side: "above"
  });
  #workspace = new SubscriptionController<HistoryWorkspace>(
    this,
    ({ activeHistory }) => {
      this.#sync();
      activeHistory.on("change", this.#sync);

      return [() => activeHistory.off("change", this.#sync)];
    }
  );

  constructor() {
    super();
    this.workspace = null;
    this._state = EMPTY_HISTORY_STATE;
    this._target = null;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("workspace") && this.workspace !== null) {
      this.#workspace.attach(this.workspace);
    }
  }

  readonly #sync = (): void => {
    const activeHistory = this.#workspace.current?.activeHistory;
    this._state = activeHistory?.state ?? EMPTY_HISTORY_STATE;
    this._target = activeHistory?.targetName ?? null;
  };

  #run(
    action: HistoryAction
  ): void {
    this.#workspace.current?.activeHistory[action]();
  }

  readonly #toggleSteps = (): void => {
    if (this.#popup.open) {
      this.#popup.hide();
    }
    else {
      this.#popup.show();
    }
  };

  override render(): TemplateResult {
    const { canUndo, canRedo, undoLabel, redoLabel, undoCount, redoCount, refused } = this._state;

    return html`
      ${this.#renderAction("undo", "Undo", canUndo, undoLabel, undoCount)}
      ${this.#renderAction("redo", "Redo", canRedo, redoLabel, redoCount)}
      ${refused.length === 0 ? nothing : this.#renderRefused(refused)}
    `;
  }

  #renderAction(
    action: HistoryAction,
    verb: string,
    enabled: boolean,
    step: string | null,
    count: number
  ): TemplateResult {
    const what = step === null ? verb : `${verb} ${step}`;
    const where = this._target === null ? what : `${what} in ${this._target}`;
    const title = `${where} (${historyShortcutLabel(action)})`;

    return html`
      <span class="action">
        <jolly-button
          icon=${`history-${action}`}
          icon-only
          label=${verb}
          title=${title}
          ?disabled=${!enabled}
          @click=${() => this.#run(action)}
        ></jolly-button>
        ${count > 0 ? html`<span class="count" aria-hidden="true">${count}</span>` : nothing}
      </span>
    `;
  }

  #renderRefused(
    refused: readonly HistoryStepInfo[]
  ): TemplateResult {
    const peers = this.#workspace.current?.presence.peers ?? [];
    const title = refused.length === 1 ?
      "1 step can no longer be undone" :
      `${refused.length} steps can no longer be undone`;

    return html`
      <span class="action">
        <jolly-button
          ${ref(this.#marker)}
          icon="warning"
          icon-only
          label="Refused steps"
          title=${title}
          @click=${this.#toggleSteps}
        ></jolly-button>
        <span class="count refused" aria-hidden="true">${refused.length}</span>
      </span>
      <div
        ${ref(this.#steps)}
        class="steps"
        popover
        role="dialog"
        aria-label="Refused steps"
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        <ul>
          ${refused.map(({ label, refused: refusal }) => html`
            <li>
              ${label ?? "A step"}:
              <span class="reason">${describeRefusal(refusal, peers)}</span>
            </li>
          `)}
        </ul>
      </div>
    `;
  }
}

customElements.define("jolly-model-editor-history-buttons", HistoryButtons);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-history-buttons": HistoryButtons;
  }
}
