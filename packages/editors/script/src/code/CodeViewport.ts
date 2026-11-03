// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import type {
  LinePosition,
  TextLines
} from "./TextLines.ts";

export interface CodeViewportElements {
  scroller(): HTMLElement | null;
  gutter(): HTMLElement | null;
  probe(): HTMLElement | null;
}

// CONSTANTS
export const LINE_HEIGHT = 20;
const kLineHeightProperty = "--script-line-height";
const kOverscan = 8;
const kProbeLength = 10;
const kRevealMargin = 4;

export class CodeViewport implements ReactiveController {
  #host: ReactiveControllerHost & HTMLElement;
  #elements: CodeViewportElements;
  #first = 0;
  #last = 0;
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
    this.#host.style.setProperty(kLineHeightProperty, `${LINE_HEIGHT}px`);
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

  visibleLines(
    count: number
  ): number[] {
    const lines: number[] = [];
    for (let line = this.#first; line <= Math.min(this.#last, count - 1); line++) {
      lines.push(line);
    }

    return lines;
  }

  clampToVisible(
    first: number,
    last: number
  ): readonly [number, number] {
    return [Math.max(first, this.#first), Math.min(last, this.#last)];
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

    const top = position.line * LINE_HEIGHT;
    if (top < scroller.scrollTop) {
      scroller.scrollTop = top;
    }
    else if (top + LINE_HEIGHT > scroller.scrollTop + scroller.clientHeight) {
      scroller.scrollTop = top + LINE_HEIGHT - scroller.clientHeight;
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

    const first = Math.max(Math.floor(scroller.scrollTop / LINE_HEIGHT) - kOverscan, 0);
    const last = Math.ceil((scroller.scrollTop + scroller.clientHeight) / LINE_HEIGHT) + kOverscan;
    if (first !== this.#first || last !== this.#last) {
      this.#first = first;
      this.#last = last;
      this.#host.requestUpdate();
    }
  }
}
