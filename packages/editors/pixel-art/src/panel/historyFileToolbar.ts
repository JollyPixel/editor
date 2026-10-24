// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderRailButton } from "../shared/railButton.ts";
import { renderIcon } from "../shared/icons.ts";
import { isInputElement } from "../shared/dom.ts";
import type { TextureImporter } from "../textures/import/TextureImporter.ts";
import type { TextureExporter } from "../textures/export/TextureExporter.ts";
import type { ClearTextureDialog } from "../textures/dialogs/ClearTextureDialog.ts";

export interface HistoryFileToolbarOptions {
  canvas: () => PixelArtCanvas | null;
  importer: TextureImporter;
  exporter: Pick<TextureExporter, "render">;
  clearDialog: () => Promise<Pick<ClearTextureDialog, "open">>;
  trailing: readonly (TemplateResult | typeof nothing)[];
  viewOnly: boolean;
}

async function clearTexture(
  event: MouseEvent,
  options: HistoryFileToolbarOptions
): Promise<void> {
  const trigger = event.currentTarget;
  const canvas = options.canvas();
  if (!canvas) {
    return;
  }

  const dialog = await options.clearDialog();
  const result = await dialog.open({
    hasUVRegions: !canvas.uv.regions.next().done
  });
  if (trigger instanceof HTMLElement) {
    trigger.blur();
  }
  if (result !== null && options.canvas() === canvas) {
    canvas.clearTexture(result);
  }
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
  const { importer, exporter, trailing } = options;

  const canvas = options.canvas();
  const readOnly = canvas?.pixelsReadOnly ?? false;
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
      ${options.viewOnly ? html`
        <div class="toolbar-group">
          <span
            class="access-badge"
            part="access-badge"
            title="You can look at this texture but not change it"
          >${renderIcon("eyeOpen")}<span>View only</span></span>
        </div>
      ` : nothing}
      <div class="toolbar-group">
      ${renderRailButton({
        part: "undo-button",
        label: "Undo",
        icon: "undo",
        disabled: !canvas?.canUndo(),
        count: canvas?.undoDepth(),
        onClick: () => canvas?.undo()
      })}
      ${renderRailButton({
        part: "redo-button",
        label: "Redo",
        icon: "redo",
        disabled: !canvas?.canRedo(),
        count: canvas?.redoDepth(),
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
      ${exporter.render()}
      ${renderRailButton({
        part: "clear-texture-button",
        label: "Clear texture",
        icon: "clearTexture",
        disabled: readOnly,
        onClick: (event) => void clearTexture(event, options)
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
