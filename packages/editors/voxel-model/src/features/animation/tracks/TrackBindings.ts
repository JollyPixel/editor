// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { ContextMenu } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  TrackBindingsController,
  type TrackBindingsWorkspace
} from "./TrackBindingsController.ts";
import {
  TRACK_STATE_LABELS,
  type TrackBindingRow
} from "./trackBindingRows.ts";
import { ContextMenuController } from "../../../shared/ContextMenuController.ts";
import {
  EMPTY_MENU,
  menuPointBelow
} from "../../../shared/menuSession.ts";

export class TrackBindings extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
      border-top: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
    }

    h3 {
      margin: 0;
      font-size: inherit;
      font-weight: 600;
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    .path {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .state {
      color: var(--jolly-text-muted, inherit);
      white-space: nowrap;
    }

    li[data-state="missing"] .state,
    li[data-state="ambiguous"] .state {
      color: var(--jolly-danger, inherit);
    }
  `;

  #controller = new TrackBindingsController(this, {
    openMenu: (session, point) => this.#menu.open(session, point)
  });
  #menu = new ContextMenuController(
    () => this.renderRoot.querySelector<ContextMenu>("jolly-context-menu")!,
    () => EMPTY_MENU
  );

  attach(
    workspace: TrackBindingsWorkspace
  ): void {
    this.#controller.attach(workspace);
  }

  override render(): TemplateResult | typeof nothing {
    const { state } = this.#controller;
    if (state === null || state.rows.length === 0) {
      return nothing;
    }

    return html`
      <section aria-label="Tracks">
        <h3>Tracks of ${state.setName}</h3>
        <ul>${state.rows.map((row) => this.#renderRow(row))}</ul>
      </section>
      <jolly-context-menu
        label="Blocks"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderRow(
    row: TrackBindingRow
  ): TemplateResult {
    const state = row.state === "remapped" && row.target !== null ?
      `→ ${row.target}` :
      TRACK_STATE_LABELS[row.state];

    return html`
      <li data-state=${row.state} aria-label=${row.path}>
        <span class="path" title=${row.path}>${row.path}</span>
        <span class="state">${state}</span>
        <jolly-button
          label="Rebind"
          title="Rebind to a block"
          @click=${(event: MouseEvent) => this.#controller.rebind(row.path, menuPointBelow(event))}
        >Rebind…</jolly-button>
        ${row.state === "ignored" ? nothing : html`
          <jolly-button
            label="Ignore"
            title="Do not play this track on this model"
            @click=${() => this.#controller.ignore(row.path)}
          >Ignore</jolly-button>
        `}
        ${row.remapped ? html`
          <jolly-button
            label="Reset"
            title="Bind by its own path again"
            @click=${() => this.#controller.reset(row.path)}
          >Reset</jolly-button>
        ` : nothing}
      </li>
    `;
  }
}

customElements.define("jolly-model-editor-track-bindings", TrackBindings);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-track-bindings": TrackBindings;
  }
}
