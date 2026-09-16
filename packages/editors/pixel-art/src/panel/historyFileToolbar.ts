// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import {
  RAIL_DIVIDER,
  renderRailButton
} from "../shared/railButton.ts";
import { showClearTextureDialog } from "../textures/clearTextureDialog.ts";
import { isInputElement } from "../shared/dom.ts";
import type { TextureImporter } from "../textures/import/TextureImporter.ts";

export interface HistoryFileToolbarOptions {
  canvas: () => PixelArtCanvas | null;
  importer: TextureImporter;
  trailing: TemplateResult | typeof nothing;
}

async function clearTexture(
  event: MouseEvent,
  activeCanvas: () => PixelArtCanvas | null
): Promise<void> {
  const trigger = event.currentTarget;
  const canvas = activeCanvas();
  if (!canvas) {
    return;
  }

  const result = await showClearTextureDialog({
    hasUVRegions: !canvas.uv.regions.next().done
  });
  if (trigger instanceof HTMLElement) {
    trigger.blur();
  }
  if (result !== null && activeCanvas() === canvas) {
    canvas.clearTexture(result);
  }
}

async function exportPng(
  canvas: PixelArtCanvas
): Promise<void> {
  const texture = canvas.textureCanvas();
  const context = texture.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return;
  }

  const { width, height } = texture;
  const { data } = context.getImageData(0, 0, width, height);
  const png = await encodePng({
    width,
    height,
    data
  });

  const url = URL.createObjectURL(
    new Blob([png], { type: "image/png" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "texture.png";
  anchor.click();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function openFilePicker(
  event: Event
): void {
  const button = event.currentTarget;
  const input = button instanceof Element ?
    button.parentElement?.querySelector(".file-input") ?? null :
    null;
  if (isInputElement(input)) {
    input.value = "";
    input.click();
  }
}

export function renderHistoryFileToolbar(
  options: HistoryFileToolbarOptions
) {
  const { importer, trailing } = options;
  const canvas = options.canvas();
  const importing = importer.busy.state?.origin === "import";

  function onFileSelected(
    event: Event
  ): void {
    const file = isInputElement(event.target) ?
      event.target.files?.[0] :
      undefined;
    const target = options.canvas();
    if (file && target) {
      void importer.importFile(target, file, "import");
    }
  }

  return html`
    <div class="overlay-toolbar bottom" part="history-file-toolbar">
      ${renderRailButton({
        part: "undo-button",
        label: "Undo",
        icon: "undo",
        disabled: !canvas?.canUndo(),
        onClick: () => canvas?.undo()
      })}
      ${renderRailButton({
        part: "redo-button",
        label: "Redo",
        icon: "redo",
        disabled: !canvas?.canRedo(),
        onClick: () => canvas?.redo()
      })}
      ${RAIL_DIVIDER}
      ${renderRailButton({
        part: "import-button",
        label: "Import texture",
        tooltip: "Import",
        icon: importing ? html`<jolly-spinner></jolly-spinner>` : "import",
        disabled: importing,
        onClick: openFilePicker
      })}
      ${renderRailButton({
        part: "export-button",
        label: "Export texture",
        tooltip: "Export",
        icon: "export",
        onClick: () => {
          if (canvas) {
            void exportPng(canvas);
          }
        }
      })}
      ${RAIL_DIVIDER}
      ${renderRailButton({
        part: "clear-texture-button",
        label: "Clear texture",
        icon: "clearTexture",
        onClick: (event) => void clearTexture(event, options.canvas)
      })}
      ${trailing === nothing ? nothing : html`${RAIL_DIVIDER}${trailing}`}
      <input
        class="file-input" part="file-input"
        type="file" accept="image/png,image/*"
        @change=${onFileSelected}
      >
    </div>
  `;
}
