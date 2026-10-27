// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { repeat } from "lit/directives/repeat.js";
import type {
  SceneActorJSON,
  SceneComponentJSON,
  SceneTransformField,
  SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import {
  ContextMenuController,
  FolderReorder,
  MenuSession,
  SubscriptionController,
  menuPointBelow,
  type ContextMenu,
  type Folder,
  type JollyChangeDetail,
  type JollyOption,
  type MenuEntry
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/button-group";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/show-more";
import "@jolly-pixel/ui/elements/vector3";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneComponents } from "../../components/SceneComponents.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import type { SceneDraft } from "../../state/SceneDraft.ts";
import { axisValues } from "./axisValues.ts";
import { renderComponentBody } from "./componentBody.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

// CONSTANTS
const kAxes = ["x", "y", "z"] as const;
const kTransformOptions: JollyOption<SceneTransformField>[] = [
  {
    value: "position",
    label: "Position"
  },
  {
    value: "rotation",
    label: "Rotation"
  },
  {
    value: "scale",
    label: "Scale"
  }
];
const kTransformSteps: Record<SceneTransformField, number> = {
  position: 0.1,
  rotation: 1,
  scale: 0.1
};

export class InspectorPanel extends LitElement {
  #transformField: SceneTransformField = "position";
  #announcement = "";

  #reorder = new FolderReorder(this, {
    folders: () => [
      ...this.renderRoot.querySelectorAll<Folder>(".components > jolly-folder")
    ],
    zone: () => this.#components(),
    commit: (order, folder) => this.#editing.current?.document.moveComponent(
      folder.key,
      order[order.indexOf(folder) + 1]?.key
    ),
    announce: (message) => {
      this.#announcement = message;
      this.requestUpdate();
    }
  });

  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
      editing.selection.subscribe("change", repaint),
      editing.draft.subscribe("change", repaint),
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
      --jolly-field-inset-start: 0px;
    }

    .empty {
      color: var(--jolly-text-muted, #9aa3ad);
      padding: var(--jolly-space-2, 8px);
    }

    .components {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    .live-region {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .missing {
      margin: 0 0 4px;
      font-size: 11px;
      color: var(--jolly-text-muted, #9aa3ad);
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
      <jolly-separator label="Components">
        <jolly-button
          slot="actions"
          icon="plus"
          icon-only
          label="Add component"
          title="Add component"
          aria-haspopup="menu"
          @click=${(event: MouseEvent) => this.#openAddComponent(event, editing, actor.id)}
        ></jolly-button>
      </jolly-separator>
      ${actor.components.length === 0 ? nothing : html`
        <div
          class="components"
          @jolly-folder-drag=${this.#reorder.onDrag}
          @jolly-folder-reorder=${this.#reorder.onReorder}
        >
          ${repeat(
            actor.components,
            (component) => component.id,
            (component) => this.#renderComponent(
              editing,
              component,
              actor.components.length > 1
            )
          )}
        </div>
      `}
      <jolly-context-menu
        label="Add component"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
      <span class="live-region" aria-live="polite">${this.#announcement}</span>
    `;
  }

  #renderActor(
    editing: SceneEditing,
    actor: SceneActorJSON
  ): TemplateResult {
    const { document } = editing;

    return html`
      <jolly-folder
        key="actor"
        label=${actor.name}
        storage-key="scene-inspector:actor"
        flush
      >
        <jolly-button
          slot="actions"
          icon="eye"
          icon-only
          label="Visible"
          title=${actor.visible ? "Hide" : "Show"}
          .pressed=${actor.visible}
          @click=${() => document.changeVisibility(actor.id, !actor.visible)}
        ></jolly-button>
        ${this.#renderTransform(editing.draft, actor)}
      </jolly-folder>
    `;
  }

  #renderTransform(
    draft: SceneDraft,
    actor: SceneActorJSON
  ): TemplateResult {
    const field = this.#transformField;
    const current = draft.transform(actor)[field];
    function patch(
      event: ChangeEvent<Record<string, unknown>>
    ): SceneTransformPatch {
      const [x, y, z] = axisValues(
        event.detail.value,
        kAxes,
        kAxes.map((axis) => current[axis])
      );

      return { [field]: { x, y, z } };
    }

    return html`
      <jolly-button-group
        aria-label="Transform"
        .options=${kTransformOptions}
        .value=${field}
        @jolly-change=${(event: ChangeEvent<SceneTransformField>) => {
          this.#transformField = event.detail.value;
          this.requestUpdate();
        }}
      ></jolly-button-group>
      <jolly-vector3
        .step=${kTransformSteps[field]}
        .value=${{ ...current }}
        @jolly-input=${(event: ChangeEvent<Record<string, unknown>>) => draft.editTransform(
          actor.id,
          patch(event)
        )}
        @jolly-change=${(event: ChangeEvent<Record<string, unknown>>) => draft.commitTransform(
          actor.id,
          patch(event)
        )}
      ></jolly-vector3>
    `;
  }

  #renderComponent(
    editing: SceneEditing,
    component: SceneComponentJSON,
    reorderable: boolean
  ): TemplateResult {
    return html`
      <jolly-folder
        key=${component.id}
        label=${component.type}
        storage-key=${`scene-inspector:${component.id}`}
        ?reorderable=${reorderable}
        flush
      >
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          label="Remove component"
          title="Remove component"
          @click=${() => editing.document.removeComponent(component.id)}
        ></jolly-button>
        <jolly-show-more storage-key=${`scene-inspector:more:${component.type}`}>
          ${renderComponentBody(component, editing)}
        </jolly-show-more>
      </jolly-folder>
    `;
  }

  #components(): HTMLElement {
    const components = this.renderRoot.querySelector<HTMLElement>(".components");
    if (components === null) {
      throw new Error("InspectorPanel: the component list is not rendered.");
    }

    return components;
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
        addComponentEntries(editing.components),
        async(type) => {
          await editing.actions.addComponent(actorId, type);
        }
      ),
      menuPointBelow(event)
    );
  }
}

function addComponentEntries(
  components: SceneComponents
): MenuEntry<string>[] {
  const direct: MenuEntry<string>[] = [];
  const picking: MenuEntry<string>[] = [];
  for (const { definition: { type }, label, icon } of components.kinds) {
    const picks = components.picksAssets(type);
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
