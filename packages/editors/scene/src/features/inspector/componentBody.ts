// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import type { AssetType } from "@jolly-pixel/asset";
import type {
  JSONObject,
  JSONValue,
  SceneComponentJSON
} from "@jolly-pixel/asset.scene/client";
import { Systems } from "@jolly-pixel/engine";
import type { JollyChangeDetail } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/reference";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/text";

// Import Internal Dependencies
import {
  ComponentInspection,
  type InspectedRow
} from "../../components/ComponentInspection.ts";
import {
  componentAssetSlots,
  sceneComponent
} from "../../components/sceneComponents.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import "./ScriptPropertiesEditor.ts";
import type { ScriptPropertiesChangeDetail } from "./ScriptPropertiesEditor.ts";

export type ComponentBodyContext = Pick<
  SceneEditing,
  "document" | "assetSlots"
>;

type ChangeEvent<TValue> = CustomEvent<JollyChangeDetail<TValue>>;

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
    function clear(event: ChangeEvent<string | null>): void {
      if (event.detail.value === null) {
        document.changeComponentAssets(entry.id, { [slot]: null });
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
  });
}

function renderProperties(
  label: string,
  properties: Readonly<JSONObject>,
  write: (next: JSONObject) => void
): TemplateResult {
  function change(event: CustomEvent<ScriptPropertiesChangeDetail>): void {
    write(event.detail.properties);
  }

  return html`
    <jolly-separator label=${label}></jolly-separator>
    <jolly-scene-script-properties
      .properties=${properties}
      @script-properties-change=${change}
    ></jolly-scene-script-properties>
  `;
}
