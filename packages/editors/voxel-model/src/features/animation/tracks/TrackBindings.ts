// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  type ContextMenu,
  ContextMenuController,
  MenuSession,
  menuPointBelow
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/folder";

// Import Internal Dependencies
import {
  TrackBindingsController,
  type TrackBindingsEditing
} from "./TrackBindingsController.ts";
import {
  TRACK_STATE_LABELS,
  type TrackBindingRow
} from "./trackBindingRows.ts";

export class TrackBindings extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      margin: 0;
      padding-block: 0;
      padding-inline: var(--jolly-space-1, 4px) 0;
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
    () => MenuSession.EMPTY
  );

  attach(
    editing: TrackBindingsEditing
  ): void {
    this.#controller.attach(editing);
  }

  override render(): TemplateResult | typeof nothing {
    const { state } = this.#controller;
    if (state === null || state.rows.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        flush
        role="region"
        aria-label="Tracks"
        key="tracks"
        label="Tracks of ${state.setName}"
        storage-key="voxel-model:folder:tracks"
      >
        <ul>${state.rows.map((row) => this.#renderRow(row, state.editable))}</ul>
      </jolly-folder>
      <jolly-context-menu
        label="Blocks"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderRow(
    row: TrackBindingRow,
    editable: boolean
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
          ?disabled=${!editable}
          @click=${(event: MouseEvent) => this.#controller.rebind(row.path, menuPointBelow(event))}
        >Rebind…</jolly-button>
        ${row.state === "ignored" ? nothing : html`
          <jolly-button
            label="Ignore"
            title="Do not play this track on this model"
            ?disabled=${!editable}
            @click=${() => this.#controller.ignore(row.path)}
          >Ignore</jolly-button>
        `}
        ${row.remapped ? html`
          <jolly-button
            label="Reset"
            title="Bind by its own path again"
            ?disabled=${!editable}
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
