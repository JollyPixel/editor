// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import type {
  AssetReferenceData,
  AssetType
} from "@jolly-pixel/asset";
import type {
  ComponentChange,
  JSONObject,
  JSONValue,
  SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import type {
  DeclaredProperty,
  VectorRow
} from "@jolly-pixel/editor.host/scene";
import { Systems } from "@jolly-pixel/engine";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/reference";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/vector2";
import "@jolly-pixel/ui/elements/vector3";
import "@jolly-pixel/ui/elements/vector4";
import "@jolly-pixel/ui/elements/message";

// Import Internal Dependencies
import {
  ComponentInspection,
  type InspectedField,
  type InspectedList
} from "../../components/ComponentInspection.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import "./ScriptPropertiesEditor.ts";
import type { ScriptPropertiesChangeDetail } from "./ScriptPropertiesEditor.ts";

export type ComponentBodyContext = Pick<
  SceneEditing,
  "writes" | "components" | "assetSlots" | "draft" | "assets"
>;

interface RowEdit {
  preview: (next: JSONValue) => void;
  commit: (next: JSONValue) => void;
}

interface ListEdit {
  add: () => void;
  remove: (index: number) => void;
  item: (index: number, field: InspectedField) => RowEdit;
}

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

export function renderComponentBody(
  stored: SceneComponentJSON,
  context: ComponentBodyContext
): TemplateResult {
  const { draft, components } = context;
  const entry = draft.component(stored);
  const kind = components.find(entry.type);
  if (kind === undefined) {
    return html`
      <jolly-message flush>
        No package of this project provides this component. Its data is kept.
      </jolly-message>
      <pre class="unknown">${JSON.stringify(entry.data, null, 2)}</pre>
    `;
  }

  const inspection = new ComponentInspection(entry, kind, context.assets);
  function preview(change: ComponentChange): void {
    draft.editComponent(entry.id, change);
  }
  function commit(change: ComponentChange): void {
    draft.commitComponent(entry.id, change);
  }

  return html`
    ${renderAssetSlots(entry, components.assetSlots(entry.type), context)}
    ${inspection.rows.map((inspected) => {
      if (inspected.kind === "asset") {
        const { slot, label, type } = inspected.row;

        return renderAssetSlot(entry, slot, label, type, context);
      }

      if (inspected.kind === "list") {
        return renderList(inspected, {
          add: () => commit(inspection.addItem(inspected)),
          remove: (index) => commit(inspection.removeItem(inspected, index)),
          item: (index, field) => {
            return {
              preview: (next) => preview(inspection.editItem(inspected, index, field, next)),
              commit: (next) => commit(inspection.editItem(inspected, index, field, next))
            };
          }
        });
      }

      return renderRow(inspected, {
        preview: (next) => preview(inspection.edit(inspected, next)),
        commit: (next) => commit(inspection.edit(inspected, next))
      });
    })}
  `;
}

function renderList(
  list: InspectedList,
  edit: ListEdit
): TemplateResult {
  const { row, items } = list;

  return html`
    <jolly-separator label=${row.label}>
      <jolly-button
        slot="actions"
        icon="plus"
        icon-only
        label=${`Add ${row.itemLabel.toLowerCase()}`}
        title=${`Add ${row.itemLabel.toLowerCase()}`}
        @click=${edit.add}
      ></jolly-button>
    </jolly-separator>
    ${items.map((fields, index) => html`
      <jolly-folder
        label=${`${row.itemLabel} ${index + 1}`}
        open
        flush
      >
        <jolly-button
          slot="actions"
          icon="trash"
          icon-only
          label=${`Remove ${row.itemLabel.toLowerCase()} ${index + 1}`}
          title=${`Remove ${row.itemLabel.toLowerCase()}`}
          @click=${() => edit.remove(index)}
        ></jolly-button>
        ${fields.map((field) => renderRow(field, edit.item(index, field)))}
      </jolly-folder>
    `)}
  `;
}

function renderRow(
  inspected: InspectedField,
  edit: RowEdit
): TemplateResult {
  const { row, value, fallback } = inspected;
  const { preview, commit } = edit;

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
          @jolly-input=${(event: ChangeEvent<number>) => preview(event.detail.value)}
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
          @jolly-input=${(event: ChangeEvent<string>) => preview(event.detail.value)}
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
    case "vector":
      return renderVector(row, value, fallback, edit);
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
        row.declared ?? [],
        commit
      );
  }
}

function renderAssetSlots(
  entry: SceneComponentJSON,
  slots: Readonly<Record<string, AssetType<unknown>>>,
  context: ComponentBodyContext
): TemplateResult[] {
  return Object.entries(slots).map(([slot, type]) => renderAssetSlot(
    entry,
    slot,
    slot[0].toUpperCase() + slot.slice(1),
    type,
    context
  ));
}

function renderAssetSlot(
  entry: SceneComponentJSON,
  slot: string,
  label: string,
  type: AssetType<unknown>,
  context: ComponentBodyContext
): TemplateResult {
  const { assetSlots, writes, components } = context;
  const reference = entry.assets[slot] ?? null;
  function change(next: AssetReferenceData | null): void {
    writes.changeComponentAssets(
      entry.id,
      components.assetChange(entry, slot, next)
    );
  }
  async function pick(): Promise<void> {
    const picked = await assetSlots.pick(type, reference);
    if (picked !== null) {
      change(picked);
    }
  }
  function clear(event: ChangeEvent<string | null>): void {
    if (event.detail.value === null) {
      change(null);
    }
  }
  function open(): void {
    if (reference !== null) {
      assetSlots.open?.(reference);
    }
  }

  return html`
    <jolly-reference
      label=${label}
      .value=${reference?.id ?? null}
      .text=${reference === null ? "" : assetSlots.name(reference)}
      @jolly-browse=${pick}
      @jolly-change=${clear}
      @jolly-open=${open}
    ></jolly-reference>
  `;
}

function renderVector(
  row: VectorRow,
  value: unknown,
  fallback: unknown,
  edit: RowEdit
): TemplateResult {
  const vector = Systems.isJSONObject(value) ? { ...value } : {};
  const min = row.min ?? -Infinity;
  const max = row.max ?? Infinity;
  const step = row.step ?? 0.1;
  function input(event: ChangeEvent<JSONObject>): void {
    edit.preview(event.detail.value);
  }
  function change(event: ChangeEvent<JSONObject>): void {
    edit.commit(event.detail.value);
  }

  switch (row.size ?? 3) {
    case 2:
      return html`
        <jolly-vector2
          label=${row.label}
          .value=${vector}
          .default=${fallback}
          .min=${min}
          .max=${max}
          .step=${step}
          @jolly-input=${input}
          @jolly-change=${change}
        ></jolly-vector2>
      `;
    case 4:
      return html`
        <jolly-vector4
          label=${row.label}
          .value=${vector}
          .default=${fallback}
          .min=${min}
          .max=${max}
          .step=${step}
          @jolly-input=${input}
          @jolly-change=${change}
        ></jolly-vector4>
      `;
    default:
      return html`
        <jolly-vector3
          label=${row.label}
          .value=${vector}
          .default=${fallback}
          .min=${min}
          .max=${max}
          .step=${step}
          @jolly-input=${input}
          @jolly-change=${change}
        ></jolly-vector3>
      `;
  }
}

function renderProperties(
  label: string,
  properties: Readonly<JSONObject>,
  declared: readonly DeclaredProperty[],
  write: (next: JSONObject) => void
): TemplateResult {
  function change(event: CustomEvent<ScriptPropertiesChangeDetail>): void {
    write(event.detail.properties);
  }

  return html`
    <jolly-separator label=${label}></jolly-separator>
    <jolly-scene-script-properties
      .properties=${properties}
      .declared=${declared}
      @script-properties-change=${change}
    ></jolly-scene-script-properties>
  `;
}
