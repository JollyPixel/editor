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
import type { BlockRenderSources } from "./blockGeometry.ts";
import type { TilesetEntry } from "../tilesets/tilesetEntry.ts";
import { tileSizeSegments } from "../tilesets/tileSizes.ts";
import "./BlockShapePreview.ts";

// CONSTANTS
export const MISSING_TILESET = "Missing tileset";
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
    --jolly-field-inset-start: 0;
    --jolly-field-inset-end: 0;
  }
`;

export interface BlockShapeColumn {
  open: boolean;
  sources: BlockRenderSources;
  block: ResolvedBlockDefinition | null;
  size: number | undefined;
  onSizeChange: (event: CustomEvent<JollyChangeDetail<number>>) => void;
}

export function shapeOptions(
  shapes: BlockShapeRegistry
): JollyOption<BlockShapeID>[] {
  return [...shapes.ids()].map((id) => {
    return {
      label: id,
      value: id
    };
  });
}

export function tilesetOptions(
  entries: readonly TilesetEntry[],
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
      label: MISSING_TILESET,
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
