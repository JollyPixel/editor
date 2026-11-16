// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  SceneEnvironment,
  type SceneEnvironmentJSON,
  type SceneEnvironmentPatch,
  type SceneFogJSON,
  type SceneFogKind,
  type SceneGlowJSON
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

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;
type EnvironmentMapKind = SceneEnvironmentJSON["environment"]["kind"];

interface FieldEdits<TValue> {
  preview(value: TValue): void;
  commit(value: TValue): void;
}

interface NumberRange {
  min: number;
  max?: number;
  step: number;
}

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
  #editing = new SubscriptionController<SceneEditing>(this, (editing) => {
    const repaint = (): void => this.requestUpdate();

    return [
      editing.document.subscribe("change", repaint),
      editing.document.subscribe("reset", repaint),
      editing.draft.subscribe("change", repaint)
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

    const { draft } = editing;
    const environment = draft.environment();
    const edits: FieldEdits<SceneEnvironmentPatch> = {
      preview: (patch) => draft.editEnvironment(patch),
      commit: (patch) => draft.commitEnvironment(patch)
    };
    const environmentMapEdits = mapEdits(
      edits,
      (map: SceneEnvironmentJSON["environment"]) => {
        return { environment: map };
      }
    );

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
          @jolly-change=${(event: ChangeEvent<boolean>) => edits.commit({
            background: event.detail.value ? kDefaultBackground : null
          })}
        ></jolly-checkbox>
        ${environment.background === null ?
          nothing :
          colorField(
            "Background",
            environment.background,
            mapEdits(edits, (background: string) => {
              return { background };
            })
          )}
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
          @jolly-change=${(event: ChangeEvent<EnvironmentMapKind>) => environmentMapEdits.commit({
            ...environment.environment,
            kind: event.detail.value
          })}
        ></jolly-select>
        ${numberField(
          "Intensity",
          environment.environment.intensity,
          { min: 0, step: 0.05 },
          editField(environmentMapEdits, environment.environment, "intensity")
        )}
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
          @jolly-change=${(event: ChangeEvent<SceneFogKind>) => edits.commit({
            fog: SceneEnvironment.switchFog(environment.fog, event.detail.value)
          })}
        ></jolly-select>
        ${renderFogFields(
          environment.fog,
          mapEdits(edits, (fog: SceneFogJSON) => {
            return { fog };
          })
        )}
      </jolly-folder>
      <jolly-folder
        key="glow"
        label="Glow"
        storage-key="scene:folder:glow"
        flush
      >
        <jolly-checkbox
          label="Bloom"
          .value=${environment.glow !== null}
          @jolly-change=${(event: ChangeEvent<boolean>) => edits.commit({
            glow: SceneEnvironment.switchGlow(environment.glow, event.detail.value)
          })}
        ></jolly-checkbox>
        ${renderGlowFields(
          environment.glow,
          mapEdits(edits, (glow: SceneGlowJSON) => {
            return { glow };
          })
        )}
      </jolly-folder>
    `;
  }
}

function renderGlowFields(
  glow: SceneGlowJSON | null,
  edits: FieldEdits<SceneGlowJSON>
): TemplateResult | typeof nothing {
  if (glow === null) {
    return nothing;
  }

  return html`
    ${numberField(
      "Strength",
      glow.strength,
      { min: 0, step: 0.05 },
      editField(edits, glow, "strength")
    )}
    ${numberField(
      "Radius",
      glow.radius,
      { min: 0, max: 1, step: 0.05 },
      editField(edits, glow, "radius")
    )}
  `;
}

function renderFogFields(
  fog: SceneFogJSON,
  edits: FieldEdits<SceneFogJSON>
): TemplateResult | typeof nothing {
  if (fog.kind === "none") {
    return nothing;
  }

  const color = colorField(
    "Color",
    fog.color,
    editField(edits, fog, "color")
  );
  if (fog.kind === "exp2") {
    return html`
      ${color}
      ${numberField(
        "Density",
        fog.density,
        { min: 0, step: 0.001 },
        editField(edits, fog, "density")
      )}
    `;
  }

  return html`
    ${color}
    ${numberField(
      "Near",
      fog.near,
      { min: 0, step: 0.5 },
      editField(edits, fog, "near")
    )}
    ${numberField(
      "Far",
      fog.far,
      { min: 0, step: 0.5 },
      editField(edits, fog, "far")
    )}
  `;
}

function numberField(
  label: string,
  value: number,
  range: NumberRange,
  edits: FieldEdits<number>
): TemplateResult {
  return html`
    <jolly-number
      label=${label}
      .min=${range.min}
      .max=${range.max ?? Number.POSITIVE_INFINITY}
      .step=${range.step}
      .value=${value}
      @jolly-input=${(event: ChangeEvent<number>) => edits.preview(event.detail.value)}
      @jolly-change=${(event: ChangeEvent<number>) => edits.commit(event.detail.value)}
    ></jolly-number>
  `;
}

function colorField(
  label: string,
  value: string,
  edits: FieldEdits<string>
): TemplateResult {
  return html`
    <jolly-color
      label=${label}
      .value=${value}
      @jolly-input=${(event: ChangeEvent<string>) => edits.preview(event.detail.value)}
      @jolly-change=${(event: ChangeEvent<string>) => edits.commit(event.detail.value)}
    ></jolly-color>
  `;
}

function editField<TObject extends object, TKey extends keyof TObject>(
  edits: FieldEdits<NoInfer<TObject>>,
  object: TObject,
  key: TKey
): FieldEdits<TObject[TKey]> {
  return mapEdits(edits, (value: TObject[TKey]) => {
    return {
      ...object,
      [key]: value
    };
  });
}

function mapEdits<TFrom, TTo>(
  edits: FieldEdits<TTo>,
  map: (value: TFrom) => TTo
): FieldEdits<TFrom> {
  return {
    preview: (value) => edits.preview(map(value)),
    commit: (value) => edits.commit(map(value))
  };
}

customElements.define("jolly-scene-environment", ScenePanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-environment": ScenePanel;
  }
}
