// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import { renderRailButton } from "../shared/railButton.ts";
import { showClearTextureDialog } from "../textures/clearTextureDialog.ts";
import { isInputElement } from "../shared/dom.ts";
import { PngFile } from "../shared/PngFile.ts";
import type { TextureImporter } from "../textures/import/TextureImporter.ts";

export interface HistoryFileToolbarOptions {
  canvas: () => PixelArtCanvas | null;
  importer: TextureImporter;
  exportMenu: (exportAlbedo: () => void) => TemplateResult | typeof nothing;
  trailing: readonly (TemplateResult | typeof nothing)[];
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

  new PngFile("texture.png", png).download();
}

function openFilePicker(
  event: Event
): void {
  const button = event.currentTarget;
  const input = button instanceof Element ?
    button.closest("[part=history-file-toolbar]")
      ?.querySelector(".file-input") ?? null :
    null;

  if (isInputElement(input)) {
    input.value = "";
    input.click();
  }
}

export function renderHistoryFileToolbar(
  options: HistoryFileToolbarOptions
) {
  const { importer, exportMenu, trailing } = options;

  const canvas = options.canvas();
  const readOnly = canvas?.pixelsReadOnly ?? false;
  const importing = importer.busy.state?.origin === "import";
  function exportAlbedo(): void {
    if (canvas) {
      void exportPng(canvas);
    }
  }
  const menu = exportMenu(exportAlbedo);

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
      <div class="toolbar-group">
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
      </div>
      <div class="toolbar-group">
      ${renderRailButton({
        part: "import-button",
        label: "Import texture",
        tooltip: "Import",
        icon: importing ? html`<jolly-spinner></jolly-spinner>` : "import",
        disabled: importing || readOnly,
        onClick: openFilePicker
      })}
      ${menu === nothing ? renderRailButton({
        part: "export-button",
        label: "Export texture",
        tooltip: "Export",
        icon: "export",
        onClick: exportAlbedo
      }) : menu}
      ${renderRailButton({
        part: "clear-texture-button",
        label: "Clear texture",
        icon: "clearTexture",
        disabled: readOnly,
        onClick: (event) => void clearTexture(event, options.canvas)
      })}
      </div>
      ${trailing.map((group) => (group === nothing ? nothing : html`
        <div class="toolbar-group">${group}</div>
      `))}
      <input
        class="file-input" part="file-input"
        type="file" accept="image/png,image/*"
        @change=${onFileSelected}
      >
    </div>
  `;
}
