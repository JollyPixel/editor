// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type {
  SceneComponentView,
  SceneConnectionView
} from "@jolly-pixel/asset.scene/client";
import type { DeclaredMember } from "@jolly-pixel/editor.host/scene";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import "../../app/sceneIcons.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import {
  SignalTargets,
  signature,
  type SignalComponent
} from "./SignalTargets.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

interface SignalDraft {
  componentId: string;
  signal: string;
  target: string;
  method: string;
  once: boolean;
}

// CONSTANTS
const kNoTarget: JollyOption<string> = {
  value: "",
  label: "Pick a component"
};
const kNoMethod: JollyOption<string> = {
  value: "",
  label: "Pick a method"
};

export class SignalsPanel extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
      editing.selection.subscribe("change", repaint),
      editing.live.subscribe("actorsChange", repaint),
      editing.assetSlots.subscribe(repaint)
    ];
  });
  #draft: SignalDraft | null = null;

  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
      overflow: auto;
    }

    .signal,
    .connection,
    .draft {
      padding-inline: var(--jolly-space-2, 8px);
    }

    .signal,
    .connection {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      min-height: 28px;
    }

    .signal .name {
      flex: 1;
      overflow: hidden;
      font-family: var(--jolly-font-mono, monospace);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .connection {
      padding-inline-start: var(--jolly-space-3, 12px);
      color: var(--jolly-text-muted);
    }

    .connection .target {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .connection.broken .target,
    .missing {
      color: var(--jolly-warning, #fb3);
    }

    .badge {
      padding: 0 var(--jolly-space-1, 4px);
      border-radius: var(--jolly-radius-sm, 4px);
      background: var(--jolly-control-bg-muted);
      font-size: 11px;
    }

    .draft {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding-inline-start: var(--jolly-space-3, 12px);
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--jolly-space-1, 4px);
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
    if (editing === null || id === null) {
      return html`<jolly-message>Select an actor to connect its signals.</jolly-message>`;
    }

    const actor = editing.document.tree.actor(id);
    if (actor === undefined) {
      return html`<jolly-message>Open the prefab scene to connect the signals of its actors.</jolly-message>`;
    }

    const focusedId = editing.selection.focused?.componentId;
    const focused = actor.components.filter(({ id }) => id === focusedId);
    const targets = new SignalTargets(
      (componentId) => this.#signalComponent(editing, componentId)
    );
    const rows = (focused.length === 0 ? actor.components : focused)
      .map((component) => this.#renderComponent(editing, component, targets))
      .filter((row) => row !== nothing);

    return rows.length === 0 ?
      html`<jolly-message>No component of this actor emits a signal.</jolly-message>` :
      html`${rows}`;
  }

  #signalComponent(
    editing: SceneEditing,
    id: string
  ): SignalComponent | null {
    const { tree } = editing.document;
    const component = tree.component(id);
    const actorId = tree.componentOwner(id);
    const actor = actorId === undefined ? undefined : tree.actor(actorId);
    if (component === undefined || actor === undefined) {
      return null;
    }

    return {
      id,
      actorName: actor.name,
      label: editing.components.summary(component, editing.assetSlots).label,
      signals: editing.components.signals(component, editing.assets)
    };
  }

  * #componentIds(
    editing: SceneEditing
  ): IterableIterator<string> {
    for (const actor of editing.document.tree.actors()) {
      for (const { id } of actor.components) {
        yield id;
      }
    }
  }

  #renderComponent(
    editing: SceneEditing,
    component: SceneComponentView,
    targets: SignalTargets
  ): TemplateResult | typeof nothing {
    const resolved = targets.component(component.id);
    if (resolved === null) {
      return nothing;
    }
    const declared = resolved.signals;
    const connections = component.connections ?? [];
    const signals = declared?.signals ?? [];
    const undeclared = connections.filter(
      (connection) => declared !== null &&
        !signals.some(({ key }) => key === connection.signal)
    );
    if (declared !== null && signals.length === 0 && connections.length === 0) {
      return nothing;
    }

    return html`
      <jolly-folder
        key=${component.id}
        label=${resolved.label}
        storage-key=${`scene-signals:${component.type}`}
        flush
      >
        ${declared === null ? html`<jolly-message>Loading signals…</jolly-message>` : nothing}
        ${signals.map((signal) => this.#renderSignal(editing, component, signal, targets))}
        ${undeclared.map((connection) => html`
          <div class="signal missing" title="The component no longer declares this signal.">
            <span class="name">${connection.signal}</span>
          </div>
          ${this.#renderConnection(editing, component.id, connection, targets, undefined)}
        `)}
      </jolly-folder>
    `;
  }

  #renderSignal(
    editing: SceneEditing,
    component: SceneComponentView,
    signal: DeclaredMember,
    targets: SignalTargets
  ): TemplateResult {
    const draft = this.#draft;
    const drafting = draft !== null &&
      draft.componentId === component.id &&
      draft.signal === signal.key;

    return html`
      <div class="signal">
        <span class="name">${signature(signal)}</span>
        <jolly-button
          icon="plus"
          icon-only
          label="Connect"
          title="Connect to a method"
          @click=${() => this.#editDraft({
            componentId: component.id,
            signal: signal.key,
            target: "",
            method: "",
            once: false
          })}
        ></jolly-button>
      </div>
      ${(component.connections ?? [])
        .filter((connection) => connection.signal === signal.key)
        .map((connection) => this.#renderConnection(
          editing,
          component.id,
          connection,
          targets,
          signal
        ))}
      ${drafting ? this.#renderDraft(editing, draft, targets) : nothing}
    `;
  }

  #renderConnection(
    editing: SceneEditing,
    componentId: string,
    connection: SceneConnectionView,
    targets: SignalTargets,
    signal: DeclaredMember | undefined
  ): TemplateResult {
    const problem = targets.problem(connection, signal);

    return html`
      <div
        class=${problem === null ? "connection" : "connection broken"}
        title=${problem ?? nothing}
      >
        <span class="target">→ ${targets.describe(connection)}</span>
        ${connection.once === true ? html`<span class="badge">once</span>` : nothing}
        <jolly-button
          icon="trash"
          icon-only
          label="Disconnect"
          title="Disconnect"
          @click=${() => editing.document.disconnect(componentId, connection.id)}
        ></jolly-button>
      </div>
    `;
  }

  #renderDraft(
    editing: SceneEditing,
    draft: SignalDraft,
    targets: SignalTargets
  ): TemplateResult {
    const targetOptions = targets.options(this.#componentIds(editing));
    if (targetOptions.length === 0) {
      return html`
        <div class="draft">
          <jolly-message>No component of the scene has a method to call.</jolly-message>
          <div class="actions">
            <jolly-button @click=${() => this.#editDraft(null)}>Cancel</jolly-button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="draft">
        <jolly-select
          label="Target"
          .options=${[kNoTarget, ...targetOptions]}
          .value=${draft.target}
          @jolly-change=${(event: ChangeEvent<string>) => {
            const target = event.detail.value;
            this.#editDraft({
              ...draft,
              target,
              method: targets.methodOptions(target)[0]?.value ?? ""
            });
          }}
        ></jolly-select>
        <jolly-select
          label="Method"
          .options=${[kNoMethod, ...targets.methodOptions(draft.target)]}
          .value=${draft.method}
          @jolly-change=${(event: ChangeEvent<string>) => this.#editDraft({
            ...draft,
            method: event.detail.value
          })}
        ></jolly-select>
        <jolly-checkbox
          label="Once"
          .value=${draft.once}
          @jolly-change=${(event: ChangeEvent<boolean>) => this.#editDraft({
            ...draft,
            once: event.detail.value
          })}
        ></jolly-checkbox>
        <div class="actions">
          <jolly-button @click=${() => this.#editDraft(null)}>Cancel</jolly-button>
          <jolly-button
            variant="accent"
            .disabled=${draft.target === "" || draft.method === ""}
            @click=${() => this.#connect(editing, draft)}
          >Connect</jolly-button>
        </div>
      </div>
    `;
  }

  #connect(
    editing: SceneEditing,
    draft: SignalDraft
  ): void {
    const { componentId, ...connection } = draft;
    if (editing.document.connect(componentId, connection) !== null) {
      this.#editDraft(null);
    }
  }

  #editDraft(
    draft: SignalDraft | null
  ): void {
    this.#draft = draft;
    this.requestUpdate();
  }
}

customElements.define("jolly-scene-signals", SignalsPanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-signals": SignalsPanel;
  }
}
