// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { AssetType } from "@jolly-pixel/asset";
import type {
  JSONObject,
  JSONValue,
  SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/property-row";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/vector2";
import "@jolly-pixel/ui/elements/vector3";
import "@jolly-pixel/ui/elements/vector4";

// Import Internal Dependencies
import {
  ComponentInspection,
  type InspectedRow
} from "../../components/ComponentInspection.ts";
import {
  componentAssetSlots,
  sceneComponent
} from "../../components/sceneComponents.ts";
import {
  SCRIPT_PROPERTY_TYPES,
  convertProperty,
  freePropertyKey,
  removeProperty,
  renameProperty,
  scriptProperties,
  type ScriptProperty,
  type ScriptPropertyType
} from "../../components/scriptProperties.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";

export type ComponentBodyContext = Pick<
  SceneEditing,
  "document" | "assetSlots"
>;

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

// CONSTANTS
const kVectorAxes = ["x", "y", "z", "w"] as const;
const kScriptTypeOptions: JollyOption<ScriptPropertyType>[] = SCRIPT_PROPERTY_TYPES.map(
  (type) => {
    return {
      value: type,
      label: type[0].toUpperCase() + type.slice(1)
    };
  }
);

export function renderComponentBody(
  entry: SceneComponentJSON,
  context: ComponentBodyContext
): TemplateResult {
  const kind = sceneComponent(entry.type);
  if (kind === undefined) {
    return html`
      <pre class="unknown">${JSON.stringify(entry.data, null, 2)}</pre>
    `;
  }

  const inspection = new ComponentInspection(entry, kind);

  return html`
    ${renderAssetSlots(entry, componentAssetSlots(entry.type), context)}
    ${inspection.rows.map((inspected) => renderRow(
      inspected,
      (next) => context.document.changeComponent(
        entry.id,
        inspection.edit(inspected, next)
      )
    ))}
  `;
}

export function axisValues(
  value: Readonly<Record<string, unknown>>,
  axes: readonly string[],
  current: readonly number[]
): number[] {
  return axes.map((axis, index) => {
    const next = value[axis];

    return typeof next === "number" ? next : current[index] ?? 0;
  });
}

function renderRow(
  inspected: InspectedRow,
  commit: (next: JSONValue) => void
): TemplateResult {
  const { row, value, fallback } = inspected;

  switch (row.control) {
    case "number":
      return html`
        <jolly-number
          label=${row.label}
          .value=${Number(value)}
          .default=${fallback}
          .min=${row.min ?? -Infinity}
          .max=${row.max ?? Infinity}
          .step=${row.step ?? 1}
          @jolly-change=${(event: ChangeEvent<number>) => commit(event.detail.value)}
        ></jolly-number>
      `;
    case "boolean":
      return html`
        <jolly-checkbox
          label=${row.label}
          .value=${value === true}
          @jolly-change=${(event: ChangeEvent<boolean>) => commit(event.detail.value)}
        ></jolly-checkbox>
      `;
    case "color":
      return html`
        <jolly-color
          label=${row.label}
          .value=${String(value)}
          .default=${fallback}
          @jolly-change=${(event: ChangeEvent<string>) => commit(event.detail.value)}
        ></jolly-color>
      `;
    case "choice":
      return html`
        <jolly-select
          label=${row.label}
          .options=${row.options}
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => commit(event.detail.value)}
        ></jolly-select>
      `;
    case "text":
      return html`
        <jolly-text
          label=${row.label}
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => commit(event.detail.value.trim())}
        ></jolly-text>
      `;
    case "properties":
      return renderProperties(
        row.label,
        Systems.isJSONObject(value) ? value : {},
        commit
      );
  }
}

function renderAssetSlots(
  entry: SceneComponentJSON,
  slots: Readonly<Record<string, AssetType<unknown>>>,
  context: ComponentBodyContext
): TemplateResult[] {
  const { assetSlots, document } = context;

  return Object.entries(slots).map(([slot, type]) => {
    const reference = entry.assets[slot] ?? null;
    const label = slot[0].toUpperCase() + slot.slice(1);
    async function pick(): Promise<void> {
      const picked = await assetSlots.pick(type, reference);
      if (picked !== null) {
        document.changeComponentAssets(entry.id, { [slot]: picked });
      }
    }
    const open = assetSlots.open;

    return html`
      <jolly-property-row label=${label}>
        <div class="slot">
          <span class="slot-name">${reference === null ? "None" : assetSlots.name(reference)}</span>
          <jolly-button @click=${pick}>Change…</jolly-button>
          <jolly-button
            ?disabled=${reference === null}
            @click=${() => document.changeComponentAssets(entry.id, { [slot]: null })}
          >Clear</jolly-button>
          ${open === null ?
            nothing :
            html`
              <jolly-button
                ?disabled=${reference === null}
                @click=${() => reference !== null && open(reference)}
              >Open in editor</jolly-button>
            `}
        </div>
      </jolly-property-row>
    `;
  });
}

function renderProperties(
  label: string,
  properties: Readonly<JSONObject>,
  write: (next: JSONObject) => void
): TemplateResult {
  function add(): void {
    write({
      ...properties,
      [freePropertyKey(properties)]: 0
    });
  }

  return html`
    <jolly-separator label=${label}></jolly-separator>
    ${scriptProperties(properties).map((property) => renderScriptProperty(
      property,
      properties,
      write
    ))}
    <jolly-button icon="plus" @click=${add}>Add property</jolly-button>
  `;
}

function renderScriptProperty(
  property: ScriptProperty,
  properties: Readonly<JSONObject>,
  write: (next: JSONObject) => void
): TemplateResult {
  function setValue(value: JSONValue): void {
    write({
      ...properties,
      [property.key]: value
    });
  }

  return html`
    <div class="property">
      <div class="property-head">
        <jolly-text
          label=""
          .value=${property.key}
          @jolly-change=${(event: ChangeEvent<string>) => {
            const key = event.detail.value.trim();
            if (key !== "") {
              write(renameProperty(properties, property.key, key));
            }
          }}
        ></jolly-text>
        <jolly-select
          label=""
          .options=${kScriptTypeOptions}
          .value=${property.type}
          @jolly-change=${(event: ChangeEvent<ScriptPropertyType>) => setValue(
            convertProperty(property.value, event.detail.value)
          )}
        ></jolly-select>
        <jolly-button
          icon="action-delete"
          icon-only
          label="Remove property"
          title="Remove property"
          @click=${() => write(removeProperty(properties, property.key))}
        ></jolly-button>
      </div>
      ${renderPropertyValue(property, setValue)}
    </div>
  `;
}

function renderPropertyValue(
  property: ScriptProperty,
  setValue: (value: JSONValue) => void
): TemplateResult {
  const { type, value } = property;
  switch (type) {
    case "number":
      return html`
        <jolly-number
          label="Value"
          .value=${Number(value)}
          step="0.1"
          @jolly-change=${(event: ChangeEvent<number>) => setValue(event.detail.value)}
        ></jolly-number>
      `;
    case "boolean":
      return html`
        <jolly-checkbox
          label="Value"
          .value=${value === true}
          @jolly-change=${(event: ChangeEvent<boolean>) => setValue(event.detail.value)}
        ></jolly-checkbox>
      `;
    case "color":
      return html`
        <jolly-color
          label="Value"
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => setValue(event.detail.value)}
        ></jolly-color>
      `;
    case "string":
      return html`
        <jolly-text
          label="Value"
          .value=${String(value)}
          @jolly-change=${(event: ChangeEvent<string>) => setValue(event.detail.value)}
        ></jolly-text>
      `;
    case "vector2":
    case "vector3":
    case "vector4":
      return renderVector(type, value, setValue);
  }
}

function renderVector(
  type: "vector2" | "vector3" | "vector4",
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
    case "vector2":
      return html`<jolly-vector2 label="Value" .value=${vector} @jolly-change=${commit}></jolly-vector2>`;
    case "vector3":
      return html`<jolly-vector3 label="Value" .value=${vector} @jolly-change=${commit}></jolly-vector3>`;
    case "vector4":
      return html`<jolly-vector4 label="Value" .value=${vector} @jolly-change=${commit}></jolly-vector4>`;
  }
}
