// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import {
  SubscriptionController,
  type ContextMenu,
  type JollyContextActionDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  LIGHTING_OPTIONS,
  lightingOption
} from "./lightingOptions.ts";
import type { ViewWorkspace } from "./ViewPanel.ts";

export class LightingMenu extends LitElement {
  static override styles = css`
    :host {
      position: absolute;
      top: var(--jolly-space-2, 8px);
      left: var(--jolly-space-2, 8px);
      padding: 2px;
      border-radius: 6px;
      background: var(--jolly-surface-raised, #2b2d31);
    }
  `;

  @query("jolly-context-menu")
  declare private menu: ContextMenu;

  #workspace = new SubscriptionController<ViewWorkspace>(this, ({ view }) => [
    view.subscribe("change", () => this.requestUpdate())
  ]);

  attach(
    workspace: ViewWorkspace
  ): void {
    this.#workspace.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    const view = this.#workspace.current?.view;
    if (view === undefined) {
      return nothing;
    }

    const active = lightingOption(view.settings.lighting);

    return html`
      <jolly-button
        icon=${active.icon}
        icon-only
        label="Lighting: ${active.label}"
        title="Lighting: ${active.label}"
        aria-haspopup="menu"
        @click=${this.#open}
      ></jolly-button>
      <jolly-context-menu
        label="Lighting"
        .items=${LIGHTING_OPTIONS.map(({ value, label, icon }) => {
          return {
            id: value,
            label,
            icon
          };
        })}
        @jolly-context-action=${this.#onPick}
      ></jolly-context-menu>
    `;
  }

  readonly #open = (
    event: MouseEvent
  ): void => {
    const button = event.currentTarget;
    if (button instanceof HTMLElement) {
      const { left, bottom } = button.getBoundingClientRect();
      this.menu.openAt(left, bottom);
    }
  };

  readonly #onPick = (
    event: CustomEvent<JollyContextActionDetail>
  ): void => {
    const option = LIGHTING_OPTIONS.find(({ value }) => value === event.detail.id);
    if (option !== undefined) {
      this.#workspace.current?.view.update({ lighting: option.value });
    }
  };
}

customElements.define("jolly-model-editor-lighting-menu", LightingMenu);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-lighting-menu": LightingMenu;
  }
}
