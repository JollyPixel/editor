// Import Internal Dependencies
import { SelectionClipboard } from "./SelectionClipboard.ts";
import { placeSelection } from "../tools/selectionPlacement.ts";
import type { SelectEngine } from "../tools/SelectEngine.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { InteractionRouter } from "../input/InteractionRouter.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type {
  ClipboardAdapter,
  ClipboardOperationResult,
  DecodedSelection
} from "./types.ts";

export interface ClipboardControllerOptions {
  adapter?: ClipboardAdapter | null;
  select: Pick<
    SelectEngine,
    "hasSelection" | "exportSelection" | "importSelection" | "discard"
  >;
  router: Pick<InteractionRouter, "mode" | "pixelsReadOnly" | "textureCursor">;
  viewport: Pick<Viewport, "visibleCenter">;
  buffer: Pick<CanvasBuffer, "size" | "maxSize">;
  onResult?: (result: ClipboardOperationResult) => void;
}

export class ClipboardController {
  #clipboard: SelectionClipboard;
  #select: ClipboardControllerOptions["select"];
  #router: ClipboardControllerOptions["router"];
  #viewport: ClipboardControllerOptions["viewport"];
  #buffer: ClipboardControllerOptions["buffer"];
  #onResult?: (result: ClipboardOperationResult) => void;
  #pending = false;

  constructor(
    options: ClipboardControllerOptions
  ) {
    this.#clipboard = new SelectionClipboard({
      adapter: options.adapter === undefined ?
        systemClipboard() :
        options.adapter
    });
    this.#select = options.select;
    this.#router = options.router;
    this.#viewport = options.viewport;
    this.#buffer = options.buffer;
    this.#onResult = options.onResult;
  }

  startCopy(): boolean {
    if (!this.#select.hasSelection) {
      return false;
    }

    void this.copy();

    return true;
  }

  startPaste(): boolean {
    void this.paste();

    return true;
  }

  async copy(): Promise<ClipboardOperationResult> {
    if (this.#pending) {
      return this.#report({
        operation: "copy",
        code: "busy"
      });
    }

    const snapshot = this.#select.exportSelection();
    if (!snapshot) {
      return this.#report({
        operation: "copy",
        code: "no-selection"
      });
    }

    this.#pending = true;
    try {
      return this.#report(
        await this.#clipboard.copy(snapshot)
      );
    }
    finally {
      this.#pending = false;
    }
  }

  async paste(): Promise<ClipboardOperationResult> {
    if (this.#router.pixelsReadOnly) {
      return this.#report({
        operation: "paste",
        code: "paste-failed"
      });
    }
    if (this.#pending) {
      return this.#report({
        operation: "paste",
        code: "busy"
      });
    }

    this.#pending = true;
    try {
      const { result, selection } = await this.#clipboard.read(
        this.#buffer.maxSize
      );
      if (result.code !== "pasted" || !selection) {
        return this.#report(result);
      }

      return this.#report(
        this.#float(selection, result)
      );
    }
    finally {
      this.#pending = false;
    }
  }

  #float(
    selection: DecodedSelection,
    result: ClipboardOperationResult
  ): ClipboardOperationResult {
    const rect = placeSelection(selection, {
      cursor: this.#router.textureCursor,
      viewCenter: this.#viewport.visibleCenter(),
      bounds: this.#buffer.size()
    });

    const previousMode = this.#router.mode;
    this.#router.mode = "select";

    let imported: boolean;
    try {
      imported = this.#select.importSelection({
        rect,
        pixels: selection.pixels,
        mask: selection.mask
      });
    }
    catch {
      imported = false;
    }
    if (imported) {
      return result;
    }

    this.#select.discard();
    this.#router.mode = previousMode;

    return {
      operation: "paste",
      code: "paste-failed",
      source: result.source
    };
  }

  #report(
    result: ClipboardOperationResult
  ): ClipboardOperationResult {
    this.#onResult?.(result);

    return result;
  }
}

function systemClipboard(): ClipboardAdapter | null {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.read === "function" &&
    typeof navigator.clipboard.write === "function"
  ) {
    return navigator.clipboard;
  }

  return null;
}
