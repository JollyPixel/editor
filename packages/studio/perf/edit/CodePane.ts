// Import Third-party Dependencies
import type {
  Frame,
  Locator
} from "@playwright/test";

export interface CaretPlacement {
  offset: number;
  textLength: number;
}

export interface PanePoint {
  x: number;
  y: number;
}

export class CodePane {
  readonly #host: Locator;
  readonly #textarea: Locator;

  constructor(
    frame: Frame
  ) {
    this.#host = frame.locator("jolly-script-code");
    this.#textarea = this.#host.locator("textarea");
  }

  text(): Promise<string> {
    return this.#textarea.inputValue();
  }

  placeCaretAtLineEnd(
    fraction: number
  ): Promise<CaretPlacement> {
    return this.#textarea.evaluate(placeCaretAtLineEnd, fraction);
  }

  paste(
    text: string
  ): Promise<void> {
    return this.#textarea.evaluate(pasteAtCaret, text);
  }

  async center(): Promise<PanePoint> {
    const box = await this.#host.boundingBox();
    if (box === null) {
      throw new Error("The script code pane is not visible");
    }

    return {
      x: box.x + (box.width / 2),
      y: box.y + (box.height / 2)
    };
  }
}

function placeCaretAtLineEnd(
  textarea: HTMLTextAreaElement,
  fraction: number
): CaretPlacement {
  const text = textarea.value;
  const lineEnd = text.indexOf("\n", Math.floor(text.length * fraction));
  const offset = lineEnd === -1 ? text.length : lineEnd;
  textarea.blur();
  textarea.setSelectionRange(offset, offset);
  textarea.focus();

  return {
    offset,
    textLength: text.length
  };
}

function pasteAtCaret(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  const event = new InputEvent("input", {
    bubbles: true,
    composed: true,
    inputType: "insertFromPaste",
    data: text
  });
  textarea.setRangeText(text, textarea.selectionStart, textarea.selectionEnd, "end");
  textarea.dispatchEvent(event);
}
