// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import type {
  SceneActorJSON,
  SceneComponentJSON,
  SceneTransformField
} from "@jolly-pixel/asset.scene/client";
import {
  ContextMenuController,
  MenuSession,
  SubscriptionController,
  menuPointBelow,
  type ContextMenu,
  type JollyChangeDetail,
  type MenuEntry
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/property-row";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/vector2";
import "@jolly-pixel/ui/elements/vector3";
import "@jolly-pixel/ui/elements/vector4";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import {
  picksAssets,
  SCENE_COMPONENTS
} from "../../components/sceneComponents.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import {
  axisValues,
  renderComponentBody
} from "./componentBody.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;
const kTransformRows: readonly { field: SceneTransformField; label: string; step: number; }[] = [
  {
    field: "position",
    label: "Position",
    step: 0.1
  },
  {
    field: "rotation",
    label: "Rotation",
    step: 1
  },
  {
    field: "scale",
    label: "Scale",
    step: 0.1
  }
];

export class InspectorPanel extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
      editing.selection.subscribe("change", repaint),
      editing.assetSlots.subscribe(repaint)
    ];
  });

  #menu = new ContextMenuController(
    () => this.#contextMenu(),
    () => MenuSession.EMPTY
  );

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
      overflow: auto;
  
      --jolly-label-width: 12ch;
    }

    .empty {
      color: var(--jolly-text-muted, #9aa3ad);
      padding: var(--jolly-space-2, 8px);
    }

    .slot,
    .property-head {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      min-width: 0;
    }

    .slot-name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .property {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding-block: var(--jolly-space-1, 4px);
    }

    .unknown {
      margin: 0;
      overflow: auto;
      font-size: 11px;
      white-space: pre-wrap;
    }
  `;

  attach(
    editing: SceneEditing
  ): void {
    this.#editing.attach(editing);
  }

  override render(): TemplateResult {
    const editing = this.#editing.current;
    const id = editing?.selection.primary ?? null;
    const actor = id === null ? undefined : editing?.document.tree.actor(id);
    if (editing === null || actor === undefined) {
      return html`<p class="empty">Select an actor to inspect it.</p>`;
    }

    return html`
      ${this.#renderActor(editing, actor)}
      <jolly-separator label="Components"></jolly-separator>
      ${actor.components.map((component, index) => this.#renderComponent(
        editing,
        actor,
        component,
        index
      ))}
      <jolly-button
        icon="plus"
        aria-haspopup="menu"
        @click=${(event: MouseEvent) => this.#openAddComponent(event, editing, actor.id)}
      >Add component</jolly-button>
      <jolly-context-menu
        label="Add component"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
    `;
  }

  #renderActor(
    editing: SceneEditing,
    actor: SceneActorJSON
  ): TemplateResult {
    const { document } = editing;

    return html`
      <jolly-text
        label="Name"
        .value=${actor.name}
        @jolly-change=${(event: ChangeEvent<string>) => {
          const name = event.detail.value.trim();
          if (name !== "") {
            document.rename(actor.id, name);
          }
        }}
      ></jolly-text>
      <jolly-checkbox
        label="Visible"
        .value=${actor.visible}
        @jolly-change=${(event: ChangeEvent<boolean>) => document.changeVisibility(
          actor.id,
          event.detail.value
        )}
      ></jolly-checkbox>
      ${kTransformRows.map(({ field, label, step }) => html`
        <jolly-vector3
          label=${label}
          .step=${step}
          .value=${{ ...actor.transform[field] }}
          @jolly-change=${(event: ChangeEvent<Record<string, unknown>>) => {
            const current = actor.transform[field];
            const [x, y, z] = axisValues(
              event.detail.value,
              kAxes,
              kAxes.map((axis) => current[axis])
            );
            document.transform(actor.id, { [field]: { x, y, z } });
          }}
        ></jolly-vector3>
      `)}
    `;
  }

  #renderComponent(
    editing: SceneEditing,
    actor: SceneActorJSON,
    component: SceneComponentJSON,
    index: number
  ): TemplateResult {
    const { document } = editing;
    const siblings = actor.components;

    return html`
      <jolly-folder
        label=${component.type}
        storage-key=${`scene-inspector:${component.id}`}
      >
        <jolly-button
          slot="actions"
          icon="move-up"
          icon-only
          label="Move up"
          title="Move up"
          ?disabled=${index === 0}
          @click=${() => document.moveComponent(component.id, siblings[index - 1]?.id)}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="move-down"
          icon-only
          label="Move down"
          title="Move down"
          ?disabled=${index === siblings.length - 1}
          @click=${() => document.moveComponent(component.id, siblings[index + 2]?.id)}
        ></jolly-button>
        <jolly-button
          slot="actions"
          icon="action-delete"
          icon-only
          label="Remove component"
          title="Remove component"
          @click=${() => document.removeComponent(component.id)}
        ></jolly-button>
        ${renderComponentBody(component, editing)}
      </jolly-folder>
    `;
  }

  #contextMenu(): ContextMenu {
    const menu = this.renderRoot.querySelector("jolly-context-menu");
    if (menu === null) {
      throw new Error("InspectorPanel: the context menu is not rendered.");
    }

    return menu;
  }

  #openAddComponent(
    event: MouseEvent,
    editing: SceneEditing,
    actorId: string
  ): void {
    this.#menu.open(
      MenuSession.from(
        addComponentEntries(),
        async(type) => {
          await editing.actions.addComponent(actorId, type);
        }
      ),
      menuPointBelow(event)
    );
  }
}

function addComponentEntries(): MenuEntry<string>[] {
  const direct: MenuEntry<string>[] = [];
  const picking: MenuEntry<string>[] = [];
  for (const { definition: { type }, label, icon } of SCENE_COMPONENTS) {
    const picks = picksAssets(type);
    (picks ? picking : direct).push({
      id: type,
      label: picks ? `${label}…` : label,
      icon
    });
  }

  return picking.length === 0 ? direct : [...direct, "separator", ...picking];
}

customElements.define("jolly-scene-inspector", InspectorPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-inspector": InspectorPanel;
  }
}
