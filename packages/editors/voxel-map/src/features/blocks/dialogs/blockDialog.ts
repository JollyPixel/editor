// Import Third-party Dependencies
import {
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import type {
  BlockShapeID,
  BlockShapeRegistry,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { BlockRenderSources } from "../rendering/BlockRenderSources.ts";
import type { PreviewStage } from "../../preview/PreviewStage.ts";
import type { BlocksetEntry } from "../../blocksets/BlocksetEntry.ts";
import { tileSizeSegments } from "../../blocksets/tileSizes.ts";
import { ShapeChoices } from "../shapes/ShapeChoices.ts";
import type { ShapePreview } from "./ShapePreview.ts";
import "../rendering/BlockShapePreview.ts";

// CONSTANTS
export const MISSING_BLOCKSET = "Missing blockset";
const kUvSizeColumns = 3;

export const blockDialogStyles = css`
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 200px;
    align-items: start;
    gap: var(--jolly-space-4, 16px);
  }

  @media (width <= 460px) {
    .layout {
      grid-template-columns: minmax(0, 1fr);
    }

    .shape {
      order: -1;
      width: 200px;
      justify-self: center;
    }
  }

  .fields,
  .shape {
    display: flex;
    flex-direction: column;
    gap: var(--jolly-row-gap, 4px);

    --jolly-label-width: 80px;
    --jolly-field-inset-start: 0px;
    --jolly-field-inset-end: 0px;
  }
`;

export interface BlockShapeColumn {
  open: boolean;
  stage: PreviewStage;
  sources: BlockRenderSources;
  block: ResolvedBlockDefinition | null;
  size: number | undefined;
  onSizeChange: (event: CustomEvent<JollyChangeDetail<number>>) => void;
}

export interface BlockShapeSelect {
  shapes: BlockShapeRegistry;
  value: BlockShapeID;
  preview: ShapePreview;
  onChange: (event: CustomEvent<JollyChangeDetail<BlockShapeID>>) => void;
}

export function renderShapeSelect(
  select: BlockShapeSelect
): TemplateResult {
  return html`
    <jolly-select
      label="Shape"
      layout="grid"
      .columns=${ShapeChoices.COLUMNS}
      .options=${ShapeChoices.from(select.shapes).options}
      .value=${select.value}
      @jolly-input=${(event: CustomEvent<JollyChangeDetail<BlockShapeID>>) => {
        select.preview.show(event.detail.value);
      }}
      @jolly-change=${(event: CustomEvent<JollyChangeDetail<BlockShapeID>>) => {
        select.preview.clear();
        select.onChange(event);
      }}
    ></jolly-select>
  `;
}

export function blocksetOptions(
  entries: readonly BlocksetEntry[],
  missing: boolean
): JollyOption<string>[] {
  const options: JollyOption<string>[] = entries.map((entry) => {
    return {
      label: entry.label,
      value: entry.definition.id
    };
  });
  if (missing) {
    options.unshift({
      label: MISSING_BLOCKSET,
      value: "",
      disabled: true
    });
  }

  return options;
}

export function renderShapeColumn(
  column: BlockShapeColumn
): TemplateResult {
  return html`
    <div class="shape">
      ${column.open ? html`
        <block-shape-preview
          .stage=${column.stage}
          .sources=${column.sources}
          .block=${column.block}
        ></block-shape-preview>
      ` : nothing}
      <jolly-button-group
        label="UV size"
        label-position="top"
        layout="grid"
        .columns=${kUvSizeColumns}
        .options=${tileSizeSegments(column.size)}
        .value=${column.size}
        ?disabled=${column.size === undefined}
        @jolly-change=${column.onSizeChange}
      ></jolly-button-group>
    </div>
  `;
}
