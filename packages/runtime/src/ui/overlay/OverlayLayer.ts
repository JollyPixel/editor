// Import Internal Dependencies
import {
  resolveOverlayAnchor,
  type OverlayPosition
} from "./resolveOverlayAnchor.ts";

// CONSTANTS
const kDefaultPosition = "top-left";
const kDefaultInset = 8;

export type OverlayContainerTarget = HTMLElement | string;

export interface OverlayLayerOptions {
  container?: OverlayContainerTarget;
}

export interface OverlayMountOptions {
  position?: OverlayPosition;
  inset?: number;
  interactive?: boolean;
}

export interface MountedOverlay {
  dispose(): void;
}

export class OverlayLayer {
  readonly element: HTMLDivElement;

  #canvas: HTMLCanvasElement;
  #view: Window | null;
  #observer: ResizeObserver | null = null;

  #track = (): void => {
    const rect = this.#canvas.getBoundingClientRect();

    Object.assign(this.element.style, {
      left: `${rect.x}px`,
      top: `${rect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
  };

  constructor(
    canvas: HTMLCanvasElement,
    options: OverlayLayerOptions = {}
  ) {
    const document = canvas.ownerDocument;

    this.#canvas = canvas;
    this.#view = document.defaultView;
    this.element = document.createElement("div");
    this.element.setAttribute("data-runtime-overlay", "");
    this.element.style.pointerEvents = "none";

    if (options.container === undefined) {
      this.#mountTracked(document);
    }
    else {
      this.#mountContained(
        resolveOverlayContainer(options.container, document)
      );
    }
  }

  mount(
    content: HTMLElement,
    options: OverlayMountOptions = {}
  ): MountedOverlay {
    const {
      position = kDefaultPosition,
      inset = kDefaultInset,
      interactive = false
    } = options;

    const slot = this.element.ownerDocument.createElement("div");
    Object.assign(slot.style, {
      position: "absolute",
      maxWidth: `calc(100% - ${inset * 2}px)`,
      maxHeight: `calc(100% - ${inset * 2}px)`,
      pointerEvents: interactive ? "auto" : "none",
      ...resolveOverlayAnchor(position, inset)
    });
    slot.append(content);
    this.element.append(slot);

    return {
      dispose: () => slot.remove()
    };
  }

  dispose(): void {
    this.#view?.removeEventListener("resize", this.#track);
    this.#view?.removeEventListener("scroll", this.#track, true);
    this.#observer?.disconnect();
    this.#observer = null;
    this.element.remove();
  }

  #mountTracked(
    document: Document
  ): void {
    this.element.style.position = "fixed";
    document.body.append(this.element);

    this.#view?.addEventListener("resize", this.#track);
    this.#view?.addEventListener("scroll", this.#track, true);
    if (typeof ResizeObserver !== "undefined") {
      this.#observer = new ResizeObserver(this.#track);
      this.#observer.observe(this.#canvas);
    }
    this.#track();
  }

  #mountContained(
    container: HTMLElement
  ): void {
    Object.assign(this.element.style, {
      position: "absolute",
      top: "0px",
      right: "0px",
      bottom: "0px",
      left: "0px"
    });
    container.append(this.element);
  }
}

function resolveOverlayContainer(
  target: OverlayContainerTarget,
  document: Document
): HTMLElement {
  if (typeof target !== "string") {
    return target;
  }

  const element = document.querySelector(target);
  if (element === null) {
    throw new Error(
      `No overlay container matching the selector "${target}" was found.`
    );
  }
  if (!(element instanceof HTMLElement)) {
    throw new Error(
      `The overlay container matching the selector "${target}" is not ` +
      "an HTMLElement."
    );
  }

  return element;
}
