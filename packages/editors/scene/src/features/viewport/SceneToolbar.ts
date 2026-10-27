// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import type { SceneAction } from "../../keybindings/sceneActions.ts";
import { SCENE_PREFERENCES } from "../../preferences.ts";
import { SCENE_HISTORY_SCOPE } from "../history/sceneHistory.ts";
import type { GizmoMode } from "./GizmoSettings.ts";
import { sceneToolbarStyles } from "./SceneToolbar.styles.ts";

// CONSTANTS
const kModes: readonly {
  mode: GizmoMode;
  icon: string;
  label: string;
  action: SceneAction;
}[] = [
  {
    mode: "translate",
    icon: "gizmo-translate",
    label: "Move",
    action: "gizmo.translate"
  },
  {
    mode: "rotate",
    icon: "gizmo-rotate",
    label: "Rotate",
    action: "gizmo.rotate"
  },
  {
    mode: "scale",
    icon: "gizmo-scale",
    label: "Scale",
    action: "gizmo.scale"
  }
];

export class SceneToolbar extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.gizmo.subscribe("change", repaint),
      editing.history.subscribe("change", repaint),
      editing.selection.subscribe("change", repaint),
      editing.shortcuts.subscribe(repaint),
      editing.preferences.watch(SCENE_PREFERENCES, repaint)
    ];
  });

  static override styles = sceneToolbarStyles;

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

    return html`
      <jolly-rail
        orientation="horizontal"
        floating
        role="toolbar"
        aria-label="Scene tools"
      >
        ${this.#renderHistory(editing)}
        ${this.#renderGizmo(editing)}
        ${this.#renderView(editing)}
      </jolly-rail>
    `;
  }

  #renderHistory(
    editing: SceneEditing
  ): TemplateResult {
    const { history, shortcuts } = editing;
    const { undoCount, redoCount } = history.state(SCENE_HISTORY_SCOPE);

    return html`
      <div class="group" role="group" aria-label="History">
        <jolly-tool-button
          data-tool="undo"
          icon="undo"
          flyout-side="above"
          label=${shortcuts.label("Undo", "edit.undo")}
          .count=${undoCount}
          ?disabled=${undoCount === 0}
          @click=${() => history.undo(SCENE_HISTORY_SCOPE)}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="redo"
          icon="redo"
          flyout-side="above"
          label=${shortcuts.label("Redo", "edit.redo")}
          .count=${redoCount}
          ?disabled=${redoCount === 0}
          @click=${() => history.redo(SCENE_HISTORY_SCOPE)}
        ></jolly-tool-button>
      </div>
    `;
  }

  #renderGizmo(
    editing: SceneEditing
  ): TemplateResult {
    const { gizmo, shortcuts } = editing;
    const local = gizmo.space === "local";

    return html`
      <div class="group divided" role="group" aria-label="Gizmo">
        ${kModes.map(({ mode, icon, label, action }) => html`
          <jolly-tool-button
            data-tool=${mode}
            icon=${icon}
            flyout-side="above"
            label=${shortcuts.label(label, action)}
            ?active=${gizmo.mode === mode}
            @click=${() => {
              gizmo.mode = mode;
            }}
          ></jolly-tool-button>
        `)}
      </div>
      <div class="group divided" role="group" aria-label="Axes">
        <jolly-tool-button
          data-tool="space"
          icon=${local ? "gizmo-space-local" : "gizmo-space-world"}
          flyout-side="above"
          label=${shortcuts.label(
            local ? "Local axes" : "World axes",
            "gizmo.space"
          )}
          @click=${() => gizmo.toggleSpace()}
        ></jolly-tool-button>
      </div>
    `;
  }

  #renderView(
    editing: SceneEditing
  ): TemplateResult {
    const { selection, shortcuts, preferences } = editing;
    const view = preferences.values(SCENE_PREFERENCES);

    return html`
      <div class="group divided" role="group" aria-label="View">
        <jolly-tool-button
          data-tool="grid"
          icon="view-grid"
          flyout-side="above"
          label="Grid"
          ?active=${view.grid}
          @click=${() => preferences.update(SCENE_PREFERENCES, {
            grid: !view.grid
          })}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="grid-axes"
          icon="view-axes"
          flyout-side="above"
          label="Grid axes"
          ?active=${view.axes}
          ?disabled=${!view.grid}
          @click=${() => preferences.update(SCENE_PREFERENCES, {
            axes: !view.axes
          })}
        ></jolly-tool-button>
        <jolly-tool-button
          data-tool="frame"
          icon="view-frame"
          flyout-side="above"
          label=${shortcuts.label("Frame selection", "view.frame")}
          ?disabled=${selection.ids.length === 0}
          @click=${() => editing.frameSelection()}
        ></jolly-tool-button>
      </div>
    `;
  }
}

customElements.define("jolly-scene-toolbar", SceneToolbar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-toolbar": SceneToolbar;
  }
}
