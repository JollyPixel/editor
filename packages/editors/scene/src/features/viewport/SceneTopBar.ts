// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/rail-group";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import { SCENE_PREFERENCES } from "../../preferences.ts";
import { sceneTopBarStyles } from "./SceneTopBar.styles.ts";

interface ViewToggle {
  field: "grid" | "axes" | "colliders" | "snap";
  icon: string;
  label: string;
  tooltipAlign?: HTMLElementTagNameMap["jolly-tool-button"]["tooltipAlign"];
  disabled?: boolean;
}

export class SceneTopBar extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.shortcuts.subscribe(repaint),
      editing.preferences.watch(SCENE_PREFERENCES, repaint)
    ];
  });

  static override styles = sceneTopBarStyles;

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
    const { grid } = editing.preferences.values(SCENE_PREFERENCES);

    return html`
      <jolly-rail
        orientation="horizontal"
        role="toolbar"
        aria-label="Viewport"
      >
        <jolly-rail-group role="group" aria-label="Grid">
          ${this.#toggle(editing, {
            field: "grid",
            icon: "view-grid",
            label: "Grid",
            tooltipAlign: "start"
          })}
          ${this.#toggle(editing, {
            field: "axes",
            icon: "view-axes",
            label: "Grid axes",
            disabled: !grid
          })}
        </jolly-rail-group>
        <jolly-rail-group divided role="group" aria-label="Physics">
          ${this.#toggle(editing, {
            field: "colliders",
            icon: "actor-rigid-body",
            label: "Colliders"
          })}
        </jolly-rail-group>
        <jolly-rail-group class="end" role="group" aria-label="Snapping">
          ${this.#toggle(editing, {
            field: "snap",
            icon: "view-snap",
            label: editing.shortcuts.label("Snap", "gizmo.snap"),
            tooltipAlign: "end"
          })}
        </jolly-rail-group>
      </jolly-rail>
    `;
  }

  #toggle(
    editing: SceneEditing,
    toggle: ViewToggle
  ): TemplateResult {
    const {
      field,
      icon,
      label,
      tooltipAlign = "center",
      disabled = false
    } = toggle;
    const { preferences } = editing;
    const active = preferences.values(SCENE_PREFERENCES)[field];

    return html`
      <jolly-tool-button
        data-tool=${field}
        icon=${icon}
        flyout-side="below"
        tooltip-align=${tooltipAlign}
        label=${label}
        ?active=${active}
        ?disabled=${disabled}
        @click=${() => preferences.update(SCENE_PREFERENCES, {
          [field]: !active
        })}
      ></jolly-tool-button>
    `;
  }
}

customElements.define("jolly-scene-top-bar", SceneTopBar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-top-bar": SceneTopBar;
  }
}
