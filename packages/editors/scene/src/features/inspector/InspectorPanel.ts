// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { DirectiveResult } from "lit/directive.js";
import { keyed } from "lit/directives/keyed.js";
import type {
  AssetReferenceJSON,
  SceneActorView,
  SceneComponentView
} from "@jolly-pixel/asset.scene/client";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type TransformChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/reference";
import "@jolly-pixel/ui/elements/show-more";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/transform";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { ActorRole } from "../../editing/InstanceOverrides.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import type { SceneDraft } from "../../state/SceneDraft.ts";
import { renderComponentBody } from "./componentBody.ts";
import { transformPatch } from "./transformPatch.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;
type TransformEvent = CustomEvent<TransformChangeDetail>;

export class InspectorPanel extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
      editing.selection.subscribe("change", repaint),
      editing.draft.subscribe("change", repaint),
      editing.live.subscribe("actorsChange", repaint),
      editing.assetSlots.subscribe(repaint)
    ];
  });

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

    jolly-transform {
      --jolly-gutter-width: 0px;
    }

    .empty {
      color: var(--jolly-text-muted, #9aa3ad);
      padding: var(--jolly-space-2, 8px);
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

  override render(): TemplateResult | DirectiveResult {
    const editing = this.#editing.current;
    const id = editing?.selection.primary ?? null;
    const actor = id === null || editing === null ?
      null :
      editing.live.actorEntry(id);
    if (editing === null || actor === null) {
      return html`<p class="empty">Select an actor or a component to inspect it.</p>`;
    }

    const { focused } = editing.selection;
    const entry = focused === null ?
      null :
      editing.live.componentEntry(focused.componentId);
    if (entry !== null) {
      return keyed(entry.id, this.#renderComponent(editing, entry));
    }

    const role = editing.overrides.role(actor.id);

    return html`
      ${this.#renderActor(editing, actor, role)}
      ${this.#renderTransform(editing.draft, actor)}
    `;
  }

  #renderOverrideActions(
    editing: SceneEditing,
    id: string,
    role: ActorRole
  ): TemplateResult | typeof nothing {
    const { overrides } = editing;
    if (role === "own" || !overrides.actorOverridden(id)) {
      return nothing;
    }

    return html`
      ${role === "instance" ? html`
        <jolly-button
          slot="actions"
          icon="asset-export"
          icon-only
          label="Apply overrides to prefab"
          title="Apply overrides to prefab"
          @click=${() => overrides.applyToPrefab(id)}
        ></jolly-button>
      ` : nothing}
      <jolly-button
        slot="actions"
        icon="revert"
        icon-only
        label="Revert overrides"
        title="Revert overrides"
        @click=${() => overrides.revertActor(id)}
      ></jolly-button>
    `;
  }

  #renderActor(
    editing: SceneEditing,
    actor: SceneActorView,
    role: ActorRole
  ): TemplateResult {
    const { writes } = editing;

    return html`
      <jolly-folder
        key="actor"
        label=${actor.name}
        storage-key="scene-inspector:actor"
        flush
      >
        ${this.#renderOverrideActions(editing, actor.id, role)}
        <jolly-text
          label="Name"
          .value=${actor.name}
          @jolly-change=${(event: ChangeEvent<string>) => writes.rename(
            actor.id,
            event.detail.value
          )}
        ></jolly-text>
        <jolly-checkbox
          label="Visible"
          .value=${actor.visible}
          @jolly-change=${(event: ChangeEvent<boolean>) => writes.changeVisibility(
            actor.id,
            event.detail.value
          )}
        ></jolly-checkbox>
        ${actor.prefab === undefined ? nothing : this.#renderPrefab(editing, actor.prefab)}
      </jolly-folder>
    `;
  }

  #renderPrefab(
    editing: SceneEditing,
    prefab: AssetReferenceJSON
  ): TemplateResult {
    const { assetSlots } = editing;

    return html`
      <jolly-reference
        label="Scene"
        readonly
        .value=${prefab.id}
        .text=${assetSlots.name(prefab)}
        @jolly-open=${() => assetSlots.open?.(prefab)}
      ></jolly-reference>
    `;
  }

  #renderTransform(
    draft: SceneDraft,
    actor: SceneActorView
  ): TemplateResult {
    const transform = draft.transform(actor);

    return html`
      <jolly-folder
        key="transform"
        label="Transform"
        storage-key="scene-inspector:transform"
        flush
      >
        <jolly-transform
          rotation-format="euler"
          label-position="top"
          .value=${transform}
          @jolly-input=${(event: TransformEvent) => draft.editTransform(
            actor.id,
            transformPatch(event.detail, transform)
          )}
          @jolly-change=${(event: TransformEvent) => draft.commitTransform(
            actor.id,
            transformPatch(event.detail, transform)
          )}
        ></jolly-transform>
      </jolly-folder>
    `;
  }

  #renderComponent(
    editing: SceneEditing,
    component: SceneComponentView
  ): TemplateResult {
    return html`
      <jolly-folder
        key="component"
        label=${editing.components.label(component.type)}
        storage-key="scene-inspector:component"
        flush
      >
        ${this.#renderComponentAction(editing, component.id)}
        <jolly-show-more storage-key=${`scene-inspector:more:${component.type}`}>
          ${renderComponentBody(component, editing)}
        </jolly-show-more>
      </jolly-folder>
    `;
  }

  #renderComponentAction(
    editing: SceneEditing,
    id: string
  ): TemplateResult | typeof nothing {
    const { document, overrides } = editing;
    if (overrides.role(id) !== "inner") {
      return html`
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          label="Remove component"
          title="Remove component"
          @click=${() => document.removeComponent(id)}
        ></jolly-button>
      `;
    }

    return overrides.componentOverridden(id) ? html`
      <jolly-button
        slot="actions"
        icon="revert"
        icon-only
        label="Revert overrides"
        title="Revert overrides"
        @click=${() => overrides.revertComponent(id)}
      ></jolly-button>
    ` : nothing;
  }
}

customElements.define("jolly-scene-inspector", InspectorPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-inspector": InspectorPanel;
  }
}
