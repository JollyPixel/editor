// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type {
  ClipboardOperationResult,
  PixelArtCanvas,
  SelectEngineEvent
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";

// CONSTANTS
const kStatusTimeoutMs = 3_000;

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
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;
  #hasSelection = false;
  #clipboardPending = false;
  #status = "";
  #statusTimer: number | null = null;

  readonly #onSelectionStateChanged: SelectEngineEvent["selection-state-changed"] = (
    { hasSelection }
  ) => {
    this.#hasSelection = hasSelection;
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.detach();
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    this.detach();
    this.#canvas = canvas;
    this.#hasSelection = canvas.tools.select.hasSelection;
    canvas.selectionEvents.on(
      "selection-state-changed",
      this.#onSelectionStateChanged
    );
    this.#host.requestUpdate();
  }

  detach(): void {
    this.#canvas?.selectionEvents.off(
      "selection-state-changed",
      this.#onSelectionStateChanged
    );
    this.#canvas = null;
    this.#hasSelection = false;
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
    if (!message) {
      return;
    }

    this.#status = message;
    this.#clearStatusTimer();
    this.#statusTimer = window.setTimeout(
      () => this.clearStatus(),
      kStatusTimeoutMs
    );
    this.#host.requestUpdate();
  }

  clearStatus(): void {
    this.#clearStatusTimer();
    if (!this.#status) {
      return;
    }

    this.#status = "";
    this.#host.requestUpdate();
  }

  async copy(): Promise<void> {
    if (!this.#canvas || this.#clipboardPending) {
      return;
    }

    this.#clipboardPending = true;
    this.#host.requestUpdate();
    try {
      await this.#canvas.copySelection();
    }
    finally {
      this.#clipboardPending = false;
      this.#host.requestUpdate();
    }
  }

  async paste(): Promise<void> {
    if (!this.#canvas || this.#clipboardPending) {
      return;
    }

    this.#clipboardPending = true;
    this.#host.requestUpdate();
    try {
      await this.#canvas.pasteClipboard();
    }
    finally {
      this.#clipboardPending = false;
      this.#host.requestUpdate();
    }
  }

  #clearStatusTimer(): void {
    if (this.#statusTimer === null) {
      return;
    }

    window.clearTimeout(this.#statusTimer);
    this.#statusTimer = null;
  }

  render(
    active: boolean
  ) {
    if (!active) {
      return nothing;
    }

    const selectionDisabled = !this.#hasSelection;

    return html`
      <div class="select-toolbar-row">
        <div class="overlay-toolbar top" part="select-toolbar">
          <button
            class="rail-btn" part="select-copy-button"
            aria-label="Copy selection"
            ?disabled=${selectionDisabled || this.#clipboardPending}
            @click=${() => this.copy()}
          >
            ${renderIcon("copy")}
            <span class="tooltip">Copy</span>
          </button>
          <button
            class="rail-btn" part="select-paste-button"
            aria-label="Paste image"
            ?disabled=${this.#clipboardPending}
            @click=${() => this.paste()}
          >
            ${renderIcon("paste")}
            <span class="tooltip">Paste</span>
          </button>
          <div class="overlay-toolbar-divider"></div>
          <button
            class="rail-btn" part="select-rotate-button"
            aria-label="Rotate clockwise"
            ?disabled=${selectionDisabled}
            @click=${() => this.#canvas?.tools.select.rotate()}
          >
            ${renderIcon("rotateClockwise")}
            <span class="tooltip">Rotate clockwise</span>
          </button>
          <button
            class="rail-btn" part="select-flip-horizontal-button"
            aria-label="Flip horizontal"
            ?disabled=${selectionDisabled}
            @click=${() => this.#canvas?.tools.select.flipHorizontal()}
          >
            ${renderIcon("flipHorizontal")}
            <span class="tooltip">Flip horizontal</span>
          </button>
          <button
            class="rail-btn" part="select-flip-vertical-button"
            aria-label="Flip vertical"
            ?disabled=${selectionDisabled}
            @click=${() => this.#canvas?.tools.select.flipVertical()}
          >
            ${renderIcon("flipVertical")}
            <span class="tooltip">Flip vertical</span>
          </button>
          <div class="overlay-toolbar-divider"></div>
          <button
            class="rail-btn" part="select-delete-button"
            aria-label="Delete selection"
            ?disabled=${selectionDisabled}
            @click=${() => this.#canvas?.tools.select.delete()}
          >
            ${renderIcon("trash")}
            <span class="tooltip">Delete</span>
          </button>
        </div>
        <div
          class="clipboard-status"
          part="clipboard-status"
          aria-live="polite"
          aria-atomic="true"
        >${this.#status}</div>
      </div>
    `;
  }
}
