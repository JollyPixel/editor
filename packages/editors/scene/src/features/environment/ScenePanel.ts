// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { Systems } from "@jolly-pixel/ecs";
import { SCENE_ENVIRONMENT_KIND } from "@jolly-pixel/asset.scene/client";
import {
  SubscriptionController,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/reference";

// Import Internal Dependencies
import type { SceneEditing } from "../../editing/SceneEditing.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

// CONSTANTS
const kBuiltInEnvironment = "Built-in";

export class ScenePanel extends LitElement {
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
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

    const { document, assetSlots } = editing;
    const reference = document.tree.environment;
    async function pick(): Promise<void> {
      const picked = await assetSlots.pick(Systems.ENVIRONMENT_ASSET, reference);
      if (picked !== null) {
        document.changeEnvironment({
          id: picked.id,
          kind: SCENE_ENVIRONMENT_KIND
        });
      }
    }
    function clear(event: ChangeEvent<string | null>): void {
      if (event.detail.value === null) {
        document.changeEnvironment(null);
      }
    }
    function open(): void {
      if (reference !== null) {
        assetSlots.open?.(reference);
      }
    }

    return html`
      <jolly-reference
        label="Environment"
        placeholder=${kBuiltInEnvironment}
        .value=${reference?.id ?? null}
        .text=${reference === null ? "" : assetSlots.name(reference)}
        @jolly-browse=${pick}
        @jolly-change=${clear}
        @jolly-open=${open}
      ></jolly-reference>
    `;
  }
}

customElements.define("jolly-scene-environment", ScenePanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-environment": ScenePanel;
  }
}
