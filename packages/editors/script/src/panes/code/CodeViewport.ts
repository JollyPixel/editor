// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { LineRange } from "../../text/LineRange.ts";
import type {
  LinePosition,
  TextLines
} from "../../text/TextLines.ts";

export interface CodeViewportElements {
  scroller(): HTMLElement | null;
  gutter(): HTMLElement | null;
  probe(): HTMLElement | null;
}

// CONSTANTS
const kLineHeight = 20;
const kLineHeightProperty = "--script-line-height";
const kOverscan = 8;
const kProbeLength = 10;
const kRevealMargin = 4;
const kTrailingLines = 4;
const kTrailingColumns = 4;

export class CodeViewport implements ReactiveController {
  #host: ReactiveControllerHost & HTMLElement;
  #elements: CodeViewportElements;
  #visible = new LineRange(0, 0);
  #charWidth = 0;
  #frame: number | null = null;
  #resize = new ResizeObserver(() => this.schedule());

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    elements: CodeViewportElements
  ) {
    this.#host = host;
    this.#elements = elements;
    host.addController(this);
  }

  hostConnected(): void {
    this.#host.style.setProperty(kLineHeightProperty, `${kLineHeight}px`);
    this.#resize.observe(this.#host);
  }

  hostDisconnected(): void {
    this.#resize.disconnect();
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }

  hostUpdated(): void {
    if (this.#charWidth === 0) {
      const width = this.#elements.probe()?.getBoundingClientRect().width ?? 0;
      this.#charWidth = width / kProbeLength;
      this.schedule();
    }
  }

  visible(
    lines: LineRange
  ): LineRange {
    return this.#visible.intersect(lines);
  }

  top(
    line: number
  ): string {
    return `${lineTop(line)}px`;
  }

  height(
    lines: TextLines
  ): string {
    return `${lineTop(lines.count + kTrailingLines)}px`;
  }

  width(
    lines: TextLines
  ): string {
    return `${lines.widest + kTrailingColumns}ch`;
  }

  schedule(): void {
    if (this.#frame !== null) {
      return;
    }

    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#update();
    });
  }

  reveal(
    position: LinePosition,
    lines: TextLines
  ): void {
    const scroller = this.#elements.scroller();
    if (scroller === null) {
      return;
    }

    const top = lineTop(position.line);
    if (top < scroller.scrollTop) {
      scroller.scrollTop = top;
    }
    else if (top + kLineHeight > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = top + kLineHeight - scroller.clientHeight;
    }

    const margin = this.#charWidth * kRevealMargin;
    const left = lines.visualColumn(position) * this.#charWidth;
    const gutter = this.#elements.gutter()?.offsetWidth ?? 0;
    const visibleWidth = scroller.clientWidth - gutter - margin;
    if (left < scroller.scrollLeft) {
      scroller.scrollLeft = Math.max(left - margin, 0);
    }
    else if (left > scroller.scrollLeft + visibleWidth) {
      scroller.scrollLeft = left - visibleWidth;
    }
  }

  #update(): void {
    const scroller = this.#elements.scroller();
    if (scroller === null) {
      return;
    }

    const visible = new LineRange(
      Math.max(Math.floor(scroller.scrollTop / kLineHeight) - kOverscan, 0),
      Math.ceil((scroller.scrollTop + scroller.clientHeight) / kLineHeight) + kOverscan
    );
    if (!visible.equals(this.#visible)) {
      this.#visible = visible;
      this.#host.requestUpdate();
    }
  }
}

function lineTop(
  line: number
): number {
  return line * kLineHeight;
}
