// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type {
  SceneEnvironmentJSON,
  SceneEnvironmentPatch,
  SceneFogJSON
} from "@jolly-pixel/asset.scene/client";
import {
  SubscriptionController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import {
  switchFogKind,
  type SceneFogKind
} from "./sceneFog.ts";

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;
type EnvironmentMapKind = SceneEnvironmentJSON["environment"]["kind"];

// CONSTANTS
const kDefaultBackground = "#20252b";
const kEnvironmentKinds: JollyOption<EnvironmentMapKind>[] = [
  {
    value: "none",
    label: "None"
  },
  {
    value: "room",
    label: "Room"
  }
];
const kFogKinds: JollyOption<SceneFogKind>[] = [
  {
    value: "none",
    label: "None"
  },
  {
    value: "linear",
    label: "Linear"
  },
  {
    value: "exp2",
    label: "Exponential"
  }
];

export class ScenePanel extends LitElement {
  #preview: SceneEnvironmentPatch = {};
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();
    const discardPreview = (): void => {
      this.#preview = {};
      repaint();
    };

    return [
      editing.document.subscribe("change", ({ command }) => {
        if (command.action === "environment-changed") {
          discardPreview();
        }
        else {
          repaint();
        }
      }),
      editing.document.subscribe("reset", discardPreview)
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

    const { document } = editing;
    const environment = {
      ...document.tree.environment,
      ...this.#preview
    };
    const preview = (patch: SceneEnvironmentPatch): void => {
      this.#preview = {
        ...this.#preview,
        ...patch
      };
      editing.previewEnvironment(this.#preview);
      this.requestUpdate();
    };
    const change = (patch: SceneEnvironmentPatch): void => {
      this.#preview = {};
      if (!document.changeEnvironment(patch)) {
        editing.previewEnvironment(this.#preview);
      }
      this.requestUpdate();
    };

    return html`
      <jolly-folder
        key="background"
        label="Background"
        storage-key="scene:folder:background"
        flush
      >
        <jolly-checkbox
          label="Color"
          .value=${environment.background !== null}
          @jolly-change=${(event: ChangeEvent<boolean>) => change({
            background: event.detail.value ? kDefaultBackground : null
          })}
        ></jolly-checkbox>
        ${environment.background === null ?
          nothing :
          html`
            <jolly-color
              label="Background"
              .value=${environment.background}
              @jolly-input=${(event: ChangeEvent<string>) => preview({
                background: event.detail.value
              })}
              @jolly-change=${(event: ChangeEvent<string>) => change({
                background: event.detail.value
              })}
            ></jolly-color>
          `}
      </jolly-folder>
      <jolly-folder
        key="environment"
        label="Environment"
        storage-key="scene:folder:environment"
        flush
      >
        <jolly-select
          label="Map"
          .options=${kEnvironmentKinds}
          .value=${environment.environment.kind}
          @jolly-change=${(event: ChangeEvent<EnvironmentMapKind>) => change({
            environment: {
              ...environment.environment,
              kind: event.detail.value
            }
          })}
        ></jolly-select>
        <jolly-number
          label="Intensity"
          min="0"
          step="0.05"
          .value=${environment.environment.intensity}
          @jolly-input=${(event: ChangeEvent<number>) => preview({
            environment: {
              ...environment.environment,
              intensity: event.detail.value
            }
          })}
          @jolly-change=${(event: ChangeEvent<number>) => change({
            environment: {
              ...environment.environment,
              intensity: event.detail.value
            }
          })}
        ></jolly-number>
      </jolly-folder>
      <jolly-folder
        key="fog"
        label="Fog"
        storage-key="scene:folder:fog"
        flush
      >
        <jolly-select
          label="Fog"
          .options=${kFogKinds}
          .value=${environment.fog.kind}
          @jolly-change=${(event: ChangeEvent<SceneFogKind>) => change({
            fog: switchFogKind(environment.fog, event.detail.value)
          })}
        ></jolly-select>
        ${renderFogFields(
          environment.fog,
          (fog) => preview({ fog }),
          (fog) => change({ fog })
        )}
      </jolly-folder>
    `;
  }
}

function renderFogFields(
  fog: SceneFogJSON,
  preview: (fog: SceneFogJSON) => void,
  change: (fog: SceneFogJSON) => void
): TemplateResult | typeof nothing {
  if (fog.kind === "none") {
    return nothing;
  }

  const color = html`
    <jolly-color
      label="Color"
      .value=${fog.color}
      @jolly-input=${(event: ChangeEvent<string>) => preview({
        ...fog,
        color: event.detail.value
      })}
      @jolly-change=${(event: ChangeEvent<string>) => change({
        ...fog,
        color: event.detail.value
      })}
    ></jolly-color>
  `;
  if (fog.kind === "exp2") {
    return html`
      ${color}
      <jolly-number
        label="Density"
        min="0"
        step="0.001"
        .value=${fog.density}
        @jolly-input=${(event: ChangeEvent<number>) => preview({
          ...fog,
          density: event.detail.value
        })}
        @jolly-change=${(event: ChangeEvent<number>) => change({
          ...fog,
          density: event.detail.value
        })}
      ></jolly-number>
    `;
  }

  return html`
    ${color}
    <jolly-number
      label="Near"
      min="0"
      step="0.5"
      .value=${fog.near}
      @jolly-input=${(event: ChangeEvent<number>) => preview({
        ...fog,
        near: event.detail.value
      })}
      @jolly-change=${(event: ChangeEvent<number>) => change({
        ...fog,
        near: event.detail.value
      })}
    ></jolly-number>
    <jolly-number
      label="Far"
      min="0"
      step="0.5"
      .value=${fog.far}
      @jolly-input=${(event: ChangeEvent<number>) => preview({
        ...fog,
        far: event.detail.value
      })}
      @jolly-change=${(event: ChangeEvent<number>) => change({
        ...fog,
        far: event.detail.value
      })}
    ></jolly-number>
  `;
}

customElements.define("jolly-scene-environment", ScenePanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-environment": ScenePanel;
  }
}
