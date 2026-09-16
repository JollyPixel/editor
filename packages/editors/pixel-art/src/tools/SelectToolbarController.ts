// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type {
  ClipboardOperationResult,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  RAIL_DIVIDER,
  renderRailButton
} from "../shared/railButton.ts";
import { TransientStatus } from "../shared/TransientStatus.ts";

function resultMessage(
  result: ClipboardOperationResult
): string {
  switch (result.code) {
    case "copied":
      return "Copied";
    case "copied-internal-only":
      return "Copied inside JollyPixel only";
    case "no-image":
      return "Clipboard does not contain an image";
    case "access-denied":
      return "Clipboard access denied";
    case "image-empty":
      return "Image contains no visible pixels";
    case "image-too-large":
      return `Image exceeds the maximum texture size of ${result.maxSize}×${result.maxSize}`;
    case "decode-failed":
      return "Could not decode the clipboard image";
    case "paste-failed":
      return "Could not place the pasted image";
    default:
      return "";
  }
}

export class SelectToolbarController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #status: TransientStatus;
  #clipboardPending = false;

  constructor(
    host: ReactiveControllerHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#status = new TransientStatus(host);
    host.addController(this);
  }

  hostDisconnected(): void {
    this.clearStatus();
  }

  onModeChange(
    active: boolean
  ): void {
    if (!active) {
      this.clearStatus();
    }
  }

  onClipboardResult(
    result: ClipboardOperationResult
  ): void {
    const message = resultMessage(result);
    if (message) {
      this.#status.set(message);
    }
  }

  clearStatus(): void {
    this.#status.clear();
  }

  copy(): Promise<void> {
    return this.#runClipboard((canvas) => canvas.copySelection());
  }

  paste(): Promise<void> {
    return this.#runClipboard((canvas) => canvas.pasteClipboard());
  }

  async #runClipboard(
    operation: (canvas: PixelArtCanvas) => Promise<unknown>
  ): Promise<void> {
    const canvas = this.#canvas();
    if (!canvas || this.#clipboardPending) {
      return;
    }

    this.#clipboardPending = true;
    this.#host.requestUpdate();
    try {
      await operation(canvas);
    }
    finally {
      this.#clipboardPending = false;
      this.#host.requestUpdate();
    }
  }

  render(
    active: boolean
  ) {
    if (!active) {
      return nothing;
    }

    const select = this.#canvas()?.tools.select;
    const selectionDisabled = !select?.hasSelection;

    return html`
      <div class="select-toolbar-row">
        <div class="overlay-toolbar top" part="select-toolbar">
          ${renderRailButton({
            part: "select-copy-button",
            label: "Copy selection",
            tooltip: "Copy",
            icon: "copy",
            disabled: selectionDisabled || this.#clipboardPending,
            onClick: () => void this.copy()
          })}
          ${renderRailButton({
            part: "select-paste-button",
            label: "Paste image",
            tooltip: "Paste",
            icon: "paste",
            disabled: this.#clipboardPending,
            onClick: () => void this.paste()
          })}
          ${RAIL_DIVIDER}
          ${renderRailButton({
            part: "select-rotate-button",
            label: "Rotate clockwise",
            icon: "rotateClockwise",
            disabled: selectionDisabled,
            onClick: () => select?.rotate()
          })}
          ${renderRailButton({
            part: "select-flip-horizontal-button",
            label: "Flip horizontal",
            icon: "flipHorizontal",
            disabled: selectionDisabled,
            onClick: () => select?.flipHorizontal()
          })}
          ${renderRailButton({
            part: "select-flip-vertical-button",
            label: "Flip vertical",
            icon: "flipVertical",
            disabled: selectionDisabled,
            onClick: () => select?.flipVertical()
          })}
          ${RAIL_DIVIDER}
          ${renderRailButton({
            part: "select-delete-button",
            label: "Delete selection",
            tooltip: "Delete",
            icon: "trash",
            disabled: selectionDisabled,
            onClick: () => select?.delete()
          })}
        </div>
        <div
          class="clipboard-status"
          part="clipboard-status"
          aria-live="polite"
          aria-atomic="true"
        >${this.#status.value}</div>
      </div>
    `;
  }
}
