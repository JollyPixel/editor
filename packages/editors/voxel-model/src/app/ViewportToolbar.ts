// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { Vector3Like } from "three";
import {
  FieldBinding,
  SubscriptionController
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/tool-button";
import "@jolly-pixel/ui/elements/vector3";

// Import Internal Dependencies
import "../features/history/HistoryButtons.ts";
import "../features/history/HistoryLog.ts";
import "../features/transform/transformIcons.ts";
import type { HistoryEditing } from "../features/history/HistoryButtons.ts";
import type { HistoryLogEditing } from "../features/history/HistoryLog.ts";
import {
  TransformController,
  type TransformEditing
} from "../features/transform/TransformController.ts";
import { TRANSFORM_MODES } from "../features/transform/transformModes.ts";
import { viewportToolbarStyles } from "../shared/styles/viewportToolbar.styles.ts";
import type { TabStore } from "../state/index.ts";

export interface ViewportToolbarEditing extends
  HistoryEditing,
  HistoryLogEditing,
  TransformEditing {
  tab: Pick<TabStore, "transforming" | "subscribe">;
}

export class ViewportToolbar extends LitElement {
  static override styles = [
    viewportToolbarStyles,
    css`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .stack {
        position: absolute;
        bottom: 16px;
        left: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--jolly-space-2, 8px);
        max-width: calc(100% - 32px);
        transform: translateX(-50%);
      }

      jolly-rail {
        padding: var(--jolly-space-1, 4px);
        pointer-events: auto;
      }

      .rows {
        --values-fade-out: var(--jolly-duration-fast, 100ms);
        --values-resize: var(--jolly-duration-base, 160ms);
        --values-fade-in: var(--jolly-duration-base, 160ms);
        --values-easing: var(--jolly-easing, cubic-bezier(0.2, 0, 0.2, 1));
        --values-settle: calc(var(--values-fade-out) + var(--values-resize));

        display: flex;
        flex-direction: column;
      }

      .values {
        display: grid;
        grid-template-rows: 1fr;
        opacity: 1;
        transition:
          grid-template-rows var(--values-resize) var(--values-easing),
          opacity var(--values-fade-in) var(--values-easing) var(--values-resize),
          visibility 0s;
      }

      .values[inert] {
        grid-template-rows: 0fr;
        opacity: 0;
        visibility: hidden;
        transition:
          grid-template-rows var(--values-resize) var(--values-easing)
            var(--values-fade-out),
          opacity var(--values-fade-out) var(--values-easing),
          visibility 0s linear var(--values-settle);
        transition-behavior: allow-discrete;
      }

      .values-clip {
        min-height: 0;
        overflow: hidden;
      }

      @media (prefers-reduced-motion: reduce) {
        .values,
        .values[inert] {
          transition: none;
        }
      }

      .row {
        display: flex;
        align-items: center;
      }

      jolly-vector3 {
        --jolly-field-inset-start: 0px;
        --jolly-field-inset-end: 0px;

        width: 0;
        min-width: 100%;
        margin-block-start: var(--jolly-space-1, 4px);
      }
    `
  ];

  #transform = new TransformController(this);
  #axisValues = new FieldBinding<Vector3Like>(this, {
    read: () => {
      const { x, y, z } = this.#transform.axisValues;

      return { x, y, z };
    },
    write: (value) => {
      this.#transform.axisValues = value;
    }
  });

  #editing = new SubscriptionController<ViewportToolbarEditing>(
    this,
    ({ tab }) => [tab.subscribe("change", () => this.requestUpdate())]
  );

  attach(
    editing: ViewportToolbarEditing
  ): void {
    this.#editing.attach(editing);
    this.#transform.attach(editing);
  }

  override render(): TemplateResult {
    const editing = this.#editing.current;
    const transforming = editing?.tab.transforming ?? false;

    return html`
      <div class="stack">
        <jolly-model-editor-history-log
          .editing=${editing}
        ></jolly-model-editor-history-log>
        <jolly-rail
          orientation="horizontal"
          floating
          role="toolbar"
          aria-label="Model tools"
        >
          <div class="rows">
            <div class="row">
              <jolly-model-editor-history-buttons
                class="group"
                role="group"
                aria-label="History"
                .editing=${editing}
              ></jolly-model-editor-history-buttons>
              ${transforming ? this.#renderTools() : nothing}
            </div>
            ${this.#renderValues(transforming && this.#transform.selected)}
          </div>
        </jolly-rail>
      </div>
    `;
  }

  #renderTools(): TemplateResult {
    const current = this.#transform.mode;
    const local = this.#transform.space === "local";

    return html`
      <div class="group divided" role="group" aria-label="Transform mode">
        ${this.#transform.modes.map((mode) => html`
          <jolly-tool-button
            data-tool=${mode}
            icon=${TRANSFORM_MODES[mode].icon}
            flyout-side="above"
            label=${TRANSFORM_MODES[mode].label}
            ?active=${mode === current}
            @click=${() => {
              this.#transform.mode = mode;
            }}
          ></jolly-tool-button>
        `)}
      </div>
      <div class="group divided" role="group" aria-label="Transform space">
        <jolly-tool-button
          data-tool="space"
          icon=${local ? "transform-local" : "transform-global"}
          flyout-side="above"
          label=${local ? "Local axes" : "World axes"}
          ?disabled=${!TRANSFORM_MODES[current].spaces}
          @click=${() => {
            this.#transform.space = local ? "world" : "local";
          }}
        ></jolly-tool-button>
      </div>
    `;
  }

  #renderValues(
    shown: boolean
  ): TemplateResult {
    return html`
      <div class="values" ?inert=${!shown}>
        <div class="values-clip">
          <jolly-vector3
            axis-style="letter"
            step="0.01"
            ?disabled=${this.#transform.disabled}
            .value=${this.#axisValues.value}
            @jolly-change=${this.#axisValues.commit}
          ></jolly-vector3>
        </div>
      </div>
    `;
  }
}

customElements.define("jolly-model-editor-viewport-toolbar", ViewportToolbar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-viewport-toolbar": ViewportToolbar;
  }
}
