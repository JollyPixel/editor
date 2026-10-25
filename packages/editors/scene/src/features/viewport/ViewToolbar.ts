// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/tool-button";
import "@jolly-pixel/ui/elements/toolbar";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import { SCENE_HISTORY_SCOPE } from "../history/sceneHistory.ts";
import type { GizmoMode } from "./GizmoSettings.ts";

// CONSTANTS
const kModes: readonly { mode: GizmoMode; icon: string; label: string; }[] = [
  {
    mode: "translate",
    icon: "gizmo-translate",
    label: "Move"
  },
  {
    mode: "rotate",
    icon: "gizmo-rotate",
    label: "Rotate"
  },
  {
    mode: "scale",
    icon: "gizmo-scale",
    label: "Scale"
  }
];

export class ViewToolbar extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.gizmo.subscribe("change", repaint),
      editing.history.subscribe("change", repaint)
    ];
  });

  static override styles = css`
    :host {
      display: inline-flex;
    }
  `;

  attach(
    editing: SceneEditing
  ): void {
    this.#editing.attach(editing);
  }

  override render(): TemplateResult | typeof nothing {
    const editing = this.#editing.current;
    if (editing === null) {
      return nothing;
    }

    const { gizmo, history } = editing;
    const state = history.state(SCENE_HISTORY_SCOPE);

    return html`
      <jolly-toolbar label="Scene tools">
        ${kModes.map(({ mode, icon, label }) => html`
          <jolly-tool-button
            icon=${icon}
            label=${label}
            ?active=${gizmo.mode === mode}
            @click=${() => {
              gizmo.mode = mode;
            }}
          ></jolly-tool-button>
        `)}
        <jolly-tool-button
          icon=${gizmo.space === "local" ? "actor-mesh" : "scene-environment"}
          label=${gizmo.space === "local" ? "Local axes" : "World axes"}
          @click=${() => gizmo.toggleSpace()}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="undo"
          label="Undo"
          ?disabled=${state.undoCount === 0}
          @click=${() => history.undo(SCENE_HISTORY_SCOPE)}
        ></jolly-tool-button>
        <jolly-tool-button
          icon="redo"
          label="Redo"
          ?disabled=${state.redoCount === 0}
          @click=${() => history.redo(SCENE_HISTORY_SCOPE)}
        ></jolly-tool-button>
      </jolly-toolbar>
    `;
  }
}

customElements.define("jolly-scene-view-toolbar", ViewToolbar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-view-toolbar": ViewToolbar;
  }
}
