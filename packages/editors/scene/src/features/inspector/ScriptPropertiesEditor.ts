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
import type { DeclaredProperty } from "@jolly-pixel/editor.host/scene";
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
  type ListedProperty,
  type PropertyEntry,
  type ScriptListType
} from "../../components/scriptProperties.ts";
import { axisValues } from "./axisValues.ts";

export interface ScriptPropertiesChangeDetail {
  properties: JSONObject;
}

interface KeyError {
  row: string | null;
  message: string;
}

interface KeyEdit {
  rename: (key: string) => void;
  retype: (type: ScenePropertyType) => void;
}

interface ValueEdit {
  preview: (value: JSONValue) => void;
  commit: (value: JSONValue) => void;
}

interface RowParts {
  kind: ListedProperty["kind"] | "draft";
  head: TemplateResult;
  action: TemplateResult | typeof nothing;
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
  #declared: readonly DeclaredProperty[] = [];
  #preview: Readonly<JSONObject> | null = null;
  #draft = emptyDraft();
  #keyError: KeyError | null = null;

  static override styles = css`
    :host {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 88px minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--jolly-row-gap, 4px) var(--jolly-space-1, 4px);
      padding-inline: var(--jolly-space-1, 4px);
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

    .value.fill {
      grid-column: 3 / -1;
    }

    .name,
    .type {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .type {
      color: var(--jolly-text-muted);
    }
  `;

  set properties(
    value: Readonly<JSONObject>
  ) {
    this.#properties = value;
    this.#preview = null;
    this.requestUpdate();
  }

  set declared(
    value: readonly DeclaredProperty[]
  ) {
    this.#declared = value;
    this.requestUpdate();
  }

  override render(): TemplateResult {
    return html`
      ${repeat(
        scriptProperties(this.#preview ?? this.#properties, this.#declared),
        (property) => property.key,
        (property) => this.#renderListed(property)
      )}
      ${this.#renderDraft()}
    `;
  }

  #renderListed(
    property: ListedProperty
  ): TemplateResult {
    const { key } = property;
    const edit: ValueEdit = {
      preview: (value) => {
        this.#preview = {
          ...this.#properties,
          [key]: value
        };
        this.requestUpdate();
      },
      commit: (value) => this.#write({
        ...this.#properties,
        [key]: value
      })
    };
    const remove = (): void => this.#write(removeProperty(this.#properties, key));

    if (property.kind === "declared") {
      const { declared } = property;

      return renderRow(property, edit, {
        kind: "declared",
        head: html`
          <span class="name" title=${declared.description || nothing}>${declared.label}</span>
          <span class="type">${property.type}</span>
        `,
        action: Object.hasOwn(this.#properties, key) ?
          renderAction("revert", "Reset to the script default", remove) :
          nothing
      });
    }

    return renderRow(property, edit, {
      kind: "stored",
      head: this.#renderKey(property, key, {
        rename: (next) => this.#rename(key, next),
        retype: (type) => edit.commit(convertProperty(property.value, type))
      }),
      action: renderAction("trash", "Remove property", remove)
    });
  }

  #renderDraft(): TemplateResult {
    const draft = this.#draft;
    const commit = (value: JSONValue): void => this.#editDraft({
      ...draft,
      value
    });

    return renderRow(draft, { preview: commit, commit }, {
      kind: "draft",
      head: this.#renderKey(draft, null, {
        rename: (key) => this.#add(key),
        retype: (type) => this.#editDraft({
          ...draft,
          type,
          value: convertProperty(draft.value, type)
        })
      }),
      action: nothing
    });
  }

  #renderKey(
    entry: PropertyEntry,
    row: string | null,
    edit: KeyEdit
  ): TemplateResult {
    const error = this.#keyError?.row === row ? this.#keyError.message : null;

    return html`
      <jolly-text
        label=""
        placeholder=${row === null ? "New property" : nothing}
        .value=${live(entry.key)}
        .error=${error}
        @jolly-change=${(event: ChangeEvent<string>) => edit.rename(event.detail.value)}
      ></jolly-text>
      <jolly-select
        label=""
        .options=${kTypeOptions}
        .value=${entry.type}
        @jolly-change=${(event: ChangeEvent<ScenePropertyType>) => edit.retype(event.detail.value)}
      ></jolly-select>
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
    draft: PropertyEntry
  ): void {
    this.#draft = draft;
    this.#keyError = null;
    this.requestUpdate();
  }

  #write(
    properties: JSONObject
  ): void {
    this.#keyError = null;
    this.#preview = null;
    this.dispatchEvent(new CustomEvent<ScriptPropertiesChangeDetail>(
      kChangeEvent,
      {
        detail: { properties }
      }
    ));
  }
}

function emptyDraft(): PropertyEntry {
  return {
    key: "",
    type: "number",
    value: 0
  };
}

function renderRow(
  entry: PropertyEntry,
  edit: ValueEdit,
  parts: RowParts
): TemplateResult {
  const wide = kWideTypes.has(entry.type);
  const value = renderValue(entry, edit);
  const valueClass = parts.action === nothing ? "value fill" : "value";

  return html`
    <div class="property ${parts.kind}">
      ${parts.head}
      ${wide ? nothing : html`<div class=${valueClass}>${value}</div>`}
      ${parts.action}
      ${wide ? html`<div class="wide-value">${value}</div>` : nothing}
    </div>
  `;
}

function renderAction(
  icon: string,
  label: string,
  click: () => void
): TemplateResult {
  return html`
    <jolly-button
      class="remove"
      icon=${icon}
      icon-only
      label=${label}
      title=${label}
      @click=${click}
    ></jolly-button>
  `;
}

function renderValue(
  property: PropertyEntry,
  edit: ValueEdit
): TemplateResult {
  const { type, value } = property;
  const { preview, commit } = edit;
  switch (type) {
    case "number":
      return html`
        <jolly-number
          label=""
          .value=${Number(value)}
          step="0.1"
          @jolly-input=${(event: ChangeEvent<number>) => preview(event.detail.value)}
          @jolly-change=${(event: ChangeEvent<number>) => commit(event.detail.value)}
        ></jolly-number>
      `;
    case "boolean":
      return html`
        <jolly-checkbox
          label=""
          .value=${value === true}
          @jolly-change=${(event: ChangeEvent<boolean>) => commit(event.detail.value)}
        ></jolly-checkbox>
      `;
    case "Color":
      return html`
        <jolly-color
          label=""
          .value=${String(value)}
          @jolly-input=${(event: ChangeEvent<string>) => preview(event.detail.value)}
          @jolly-change=${(event: ChangeEvent<string>) => commit(event.detail.value)}
        ></jolly-color>
      `;
    case "string":
      return html`
        <jolly-text
          label=""
          placeholder="value"
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => commit(event.detail.value)}
        ></jolly-text>
      `;
    case "Vector2":
    case "Vector3":
    case "Vector4":
      return renderVector(type, value, edit);
    case "number[]":
    case "string[]":
    case "boolean[]":
      return renderList(type, value, commit);
  }
}

function renderList(
  type: ScriptListType,
  value: JSONValue,
  commit: (value: JSONValue) => void
): TemplateResult {
  return html`
    <jolly-text
      label=""
      placeholder="a, b, c"
      .value=${listText(value)}
      @jolly-change=${(event: ChangeEvent<string>) => commit(parseList(event.detail.value, type))}
    ></jolly-text>
  `;
}

function renderVector(
  type: "Vector2" | "Vector3" | "Vector4",
  value: JSONValue,
  edit: ValueEdit
): TemplateResult {
  const numbers = (Array.isArray(value) ? value : []).map(Number);
  const axes = kVectorAxes.slice(0, Number(type.at(-1)));
  const vector = Object.fromEntries(
    axes.map((axis, index) => [axis, numbers[index] ?? 0])
  );
  function preview(event: ChangeEvent<Record<string, unknown>>): void {
    edit.preview(axisValues(event.detail.value, axes, numbers));
  }
  function commit(event: ChangeEvent<Record<string, unknown>>): void {
    edit.commit(axisValues(event.detail.value, axes, numbers));
  }

  switch (type) {
    case "Vector2":
      return html`
        <jolly-vector2 .value=${vector} @jolly-input=${preview} @jolly-change=${commit}></jolly-vector2>
      `;
    case "Vector3":
      return html`
        <jolly-vector3 .value=${vector} @jolly-input=${preview} @jolly-change=${commit}></jolly-vector3>
      `;
    case "Vector4":
      return html`
        <jolly-vector4 .value=${vector} @jolly-input=${preview} @jolly-change=${commit}></jolly-vector4>
      `;
  }
}

customElements.define("jolly-scene-script-properties", ScriptPropertiesEditor);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-scene-script-properties": ScriptPropertiesEditor;
  }
}
