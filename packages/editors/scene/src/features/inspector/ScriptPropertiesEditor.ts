// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { live } from "lit/directives/live.js";
import { repeat } from "lit/directives/repeat.js";
import type {
  JSONObject,
  JSONValue
} from "@jolly-pixel/asset.scene/client";
import {
  SCENE_PROPERTY_TYPES,
  type ScenePropertyType
} from "@jolly-pixel/engine";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/vector2";
import "@jolly-pixel/ui/elements/vector3";
import "@jolly-pixel/ui/elements/vector4";

// Import Internal Dependencies
import {
  addProperty,
  convertProperty,
  listText,
  parseList,
  removeProperty,
  renameProperty,
  scriptProperties,
  type ScriptListType,
  type ScriptProperty
} from "../../components/scriptProperties.ts";
import { axisValues } from "./axisValues.ts";

export interface ScriptPropertiesChangeDetail {
  properties: JSONObject;
}

interface KeyError {
  row: string | null;
  message: string;
}

interface RowEdit {
  rename: (key: string) => void;
  retype: (type: ScenePropertyType) => void;
  setValue: (value: JSONValue) => void;
}

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

// CONSTANTS
const kChangeEvent = "script-properties-change";
const kVectorAxes = ["x", "y", "z", "w"] as const;
const kWideTypes: ReadonlySet<ScenePropertyType> = new Set([
  "Vector2",
  "Vector3",
  "Vector4",
  "Color",
  "number[]",
  "string[]",
  "boolean[]"
]);
const kTypeOptions: JollyOption<ScenePropertyType>[] = SCENE_PROPERTY_TYPES.map(
  (type) => {
    return {
      value: type,
      label: type[0].toUpperCase() + type.slice(1)
    };
  }
);

export class ScriptPropertiesEditor extends LitElement {
  #properties: Readonly<JSONObject> = {};
  #draft = emptyDraft();
  #keyError: KeyError | null = null;

  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--jolly-row-gap, 4px) var(--jolly-space-1, 4px);
      padding-inline: var(--jolly-space-1, 4px);

      --jolly-field-inset-end: 0px;
    }

    .property {
      display: contents;
    }

    .property > * {
      min-width: 0;
    }

    .remove {
      grid-column: 4;
    }

    .wide-value {
      grid-column: 1 / -1;
    }

    .draft .value {
      grid-column: 3 / -1;
    }
  `;

  set properties(
    value: Readonly<JSONObject>
  ) {
    this.#properties = value;
    this.requestUpdate();
  }

  override render(): TemplateResult {
    return html`
      ${repeat(
        scriptProperties(this.#properties),
        (property) => property.key,
        (property) => this.#renderProperty(property)
      )}
      ${this.#renderDraft()}
    `;
  }

  #renderProperty(
    property: ScriptProperty
  ): TemplateResult {
    const setValue = (value: JSONValue): void => this.#write({
      ...this.#properties,
      [property.key]: value
    });

    return this.#renderRow(
      property,
      property.key,
      {
        rename: (key) => this.#rename(property.key, key),
        retype: (type) => setValue(convertProperty(property.value, type)),
        setValue
      }
    );
  }

  #renderDraft(): TemplateResult {
    const draft = this.#draft;

    return this.#renderRow(
      draft,
      null,
      {
        rename: (key) => this.#add(key),
        retype: (type) => this.#editDraft({
          ...draft,
          type,
          value: convertProperty(draft.value, type)
        }),
        setValue: (value) => this.#editDraft({
          ...draft,
          value
        })
      }
    );
  }

  #renderRow(
    property: ScriptProperty,
    row: string | null,
    edit: RowEdit
  ): TemplateResult {
    const error = this.#keyError?.row === row ? this.#keyError.message : null;
    const wide = kWideTypes.has(property.type);
    const value = renderValue(property, edit.setValue);

    return html`
      <div class=${row === null ? "property draft" : "property"}>
        <jolly-text
          label=""
          placeholder=${row === null ? "New property" : nothing}
          .value=${live(property.key)}
          .error=${error}
          @jolly-change=${(event: ChangeEvent<string>) => edit.rename(event.detail.value)}
        ></jolly-text>
        <jolly-select
          label=""
          .options=${kTypeOptions}
          .value=${property.type}
          @jolly-change=${(event: ChangeEvent<ScenePropertyType>) => edit.retype(event.detail.value)}
        ></jolly-select>
        ${wide ? nothing : html`<div class="value">${value}</div>`}
        ${row === null ? nothing : html`
          <jolly-button
            class="remove"
            icon="action-delete"
            icon-only
            label="Remove property"
            title="Remove property"
            @click=${() => this.#write(removeProperty(this.#properties, row))}
          ></jolly-button>
        `}
        ${wide ? html`<div class="wide-value">${value}</div>` : nothing}
      </div>
    `;
  }

  #add(
    key: string
  ): void {
    const trimmed = key.trim();
    if (trimmed === "") {
      this.#editDraft({
        ...this.#draft,
        key: ""
      });

      return;
    }
    if (Object.hasOwn(this.#properties, trimmed)) {
      this.#draft = {
        ...this.#draft,
        key: trimmed
      };
      this.#refuseKey(null);

      return;
    }

    const { value } = this.#draft;
    this.#draft = emptyDraft();
    this.#write(addProperty(this.#properties, trimmed, value));
  }

  #rename(
    from: string,
    to: string
  ): void {
    const trimmed = to.trim();
    if (trimmed === from) {
      return;
    }
    if (Object.hasOwn(this.#properties, trimmed)) {
      this.#refuseKey(from);

      return;
    }

    this.#write(renameProperty(this.#properties, from, trimmed));
  }

  #refuseKey(
    row: string | null
  ): void {
    this.#keyError = {
      row,
      message: "Already exists"
    };
    this.requestUpdate();
  }

  #editDraft(
    draft: ScriptProperty
  ): void {
    this.#draft = draft;
    this.#keyError = null;
    this.requestUpdate();
  }

  #write(
    properties: JSONObject
  ): void {
    this.#keyError = null;
    this.dispatchEvent(new CustomEvent<ScriptPropertiesChangeDetail>(
      kChangeEvent,
      {
        detail: { properties }
      }
    ));
  }
}

function emptyDraft(): ScriptProperty {
  return {
    key: "",
    type: "number",
    value: 0
  };
}

function renderValue(
  property: ScriptProperty,
  setValue: (value: JSONValue) => void
): TemplateResult {
  const { type, value } = property;
  switch (type) {
    case "number":
      return html`
        <jolly-number
          label=""
          .value=${Number(value)}
          step="0.1"
          @jolly-change=${(event: ChangeEvent<number>) => setValue(event.detail.value)}
        ></jolly-number>
      `;
    case "boolean":
      return html`
        <jolly-checkbox
          label=""
          .value=${value === true}
          @jolly-change=${(event: ChangeEvent<boolean>) => setValue(event.detail.value)}
        ></jolly-checkbox>
      `;
    case "Color":
      return html`
        <jolly-color
          label=""
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => setValue(event.detail.value)}
        ></jolly-color>
      `;
    case "string":
      return html`
        <jolly-text
          label=""
          placeholder="value"
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => setValue(event.detail.value)}
        ></jolly-text>
      `;
    case "Vector2":
    case "Vector3":
    case "Vector4":
      return renderVector(type, value, setValue);
    case "number[]":
    case "string[]":
    case "boolean[]":
      return renderList(type, value, setValue);
  }
}

function renderList(
  type: ScriptListType,
  value: JSONValue,
  setValue: (value: JSONValue) => void
): TemplateResult {
  return html`
    <jolly-text
      label=""
      placeholder="a, b, c"
      .value=${listText(value)}
      @jolly-change=${(event: ChangeEvent<string>) => setValue(parseList(event.detail.value, type))}
    ></jolly-text>
  `;
}

function renderVector(
  type: "Vector2" | "Vector3" | "Vector4",
  value: JSONValue,
  setValue: (value: JSONValue) => void
): TemplateResult {
  const numbers = (Array.isArray(value) ? value : []).map(Number);
  const axes = kVectorAxes.slice(0, Number(type.at(-1)));
  const vector = Object.fromEntries(
    axes.map((axis, index) => [axis, numbers[index] ?? 0])
  );
  function commit(event: ChangeEvent<Record<string, unknown>>): void {
    setValue(axisValues(event.detail.value, axes, numbers));
  }

  switch (type) {
    case "Vector2":
      return html`<jolly-vector2 .value=${vector} @jolly-change=${commit}></jolly-vector2>`;
    case "Vector3":
      return html`<jolly-vector3 .value=${vector} @jolly-change=${commit}></jolly-vector3>`;
    case "Vector4":
      return html`<jolly-vector4 .value=${vector} @jolly-change=${commit}></jolly-vector4>`;
  }
}

customElements.define("jolly-scene-script-properties", ScriptPropertiesEditor);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-script-properties": ScriptPropertiesEditor;
  }
}
