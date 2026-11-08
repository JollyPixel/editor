// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/rail";
import "@jolly-pixel/ui/elements/tool-button";

// Import Internal Dependencies
import "../icons.ts";
import type {
  TexturePicture,
  TexturePreview,
  TextureView
} from "../image/TexturePreview.ts";
import {
  TextureViewport,
  type ViewPoint,
  type ViewSize
} from "../view/TextureViewport.ts";

// CONSTANTS
const kWheelZoomSpeed = 0.0015;
const kPinchZoomSpeed = 0.01;
const kLinePixels = 16;
const kZoomStep = 2;

interface PanDrag {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
}

export class TextureStage extends LitElement {
  #preview = new SubscriptionController<TexturePreview>(this, (preview) => [
    preview.subscribe("change", () => this.#layout())
  ]);
  #resize = new ResizeObserver(([entry]) => {
    this.#size = {
      width: entry.contentRect.width,
      height: entry.contentRect.height
    };
    this.#layout();
  });
  #size: ViewSize = {
    width: 0,
    height: 0
  };
  #viewport: TextureViewport | null = null;
  #pixelated = true;
  #drag: PanDrag | null = null;

  static override styles = css`
    :host {
      position: relative;
      display: block;
      height: 100%;
      overflow: hidden;
      color: var(--jolly-text);
    }

    .stage {
      position: absolute;
      inset: 0;
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }

    .stage.dragging {
      cursor: grabbing;
    }

    .frame {
      position: absolute;
      background-color: #2a2f34;
      background-image: conic-gradient(
        #3b4147 25%,
        transparent 0 50%,
        #3b4147 0 75%,
        transparent 0
      );
      background-size: 16px 16px;
      box-shadow: 0 0 0 1px var(--jolly-divider);
    }

    .frame img {
      display: block;
      width: 100%;
      height: 100%;
      user-select: none;
    }

    .frame.pixelated img {
      image-rendering: pixelated;
    }

    .message {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      margin: 0;
      padding: var(--jolly-space-4);
      color: var(--jolly-text-muted);
      text-align: center;
      pointer-events: none;
    }

    .message.error {
      color: var(--jolly-danger);
    }

    jolly-rail {
      position: absolute;
      inset-block-end: 16px;
      inset-inline-start: 50%;
      transform: translateX(-50%);
    }

    jolly-tool-button {
      --jolly-tool-button-size: 30px;
    }

    .group {
      display: flex;
      align-items: center;
    }

    .divided::before {
      content: "";
      flex: 0 0 auto;
      width: 1px;
      height: 22px;
      margin-inline: 6px;
      background: var(--jolly-divider);
    }

    .zoom {
      min-width: 6ch;
      font-variant-numeric: var(--jolly-font-numeric);
      text-align: center;
    }
  `;

  attach(
    preview: TexturePreview
  ): void {
    this.#preview.attach(preview);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize.disconnect();
  }

  override render(): TemplateResult {
    const view = this.#preview.current?.view ?? null;
    const picture = this.#preview.current?.picture ?? null;
    const viewport = this.#viewport;

    return html`
      <div
        class=${this.#drag === null ? "stage" : "stage dragging"}
        @wheel=${this.#onWheel}
        @pointerdown=${this.#onPointerDown}
        @pointermove=${this.#onPointerMove}
        @pointerup=${this.#onPointerUp}
        @pointercancel=${this.#onPointerUp}
        @dblclick=${() => this.fit()}
      >
        ${picture === null || viewport === null ?
          nothing :
          this.#renderFrame(picture, viewport)}
        ${this.#renderMessage(view)}
      </div>
      ${this.#renderToolbar(viewport)}
    `;
  }

  fit(): void {
    this.#place(TextureViewport.fit);
  }

  showActualSize(): void {
    this.#place(TextureViewport.actualSize);
  }

  zoomBy(
    factor: number,
    point: ViewPoint = {
      x: this.#size.width / 2,
      y: this.#size.height / 2
    }
  ): void {
    if (this.#viewport === null) {
      return;
    }

    this.#viewport = this.#viewport.zoomAt(point, factor);
    this.requestUpdate();
  }

  #renderFrame(
    picture: TexturePicture,
    viewport: TextureViewport
  ): TemplateResult {
    const { frame } = viewport;

    return html`
      <div
        class=${this.#pixelated ? "frame pixelated" : "frame"}
        style=${styleMap({
          left: `${frame.left}px`,
          top: `${frame.top}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`
        })}
      >
        <img
          src=${picture.url}
          alt=${this.#preview.current?.file.name ?? ""}
          draggable="false"
        >
      </div>
    `;
  }

  #renderMessage(
    view: TextureView | null
  ): TemplateResult | typeof nothing {
    switch (view?.status) {
      case "empty":
        return html`<p class="message">No image</p>`;
      case "loading":
        return html`<p class="message">Loading…</p>`;
      case "header":
        return html`
          <p class="message">
            The browser cannot display KTX2 textures. Details lists their size and mip levels.
          </p>
        `;
      case "failed":
        return html`<p class="message error" role="alert">${view.error}</p>`;
      default:
        return nothing;
    }
  }

  #renderToolbar(
    viewport: TextureViewport | null
  ): TemplateResult {
    const disabled = viewport === null;

    return html`
      <jolly-rail
        orientation="horizontal"
        floating
        role="toolbar"
        aria-label="View"
      >
        <div class="group" role="group" aria-label="Size">
          <jolly-tool-button
            data-tool="fit"
            icon="texture-fit"
            flyout-side="above"
            label="Fit to view"
            ?disabled=${disabled}
            @click=${() => this.fit()}
          ></jolly-tool-button>
          <jolly-tool-button
            data-tool="actual-size"
            icon="texture-actual-size"
            flyout-side="above"
            label="Actual size"
            ?disabled=${disabled}
            @click=${() => this.showActualSize()}
          ></jolly-tool-button>
        </div>
        <div class="group divided" role="group" aria-label="Zoom">
          <jolly-tool-button
            data-tool="zoom-out"
            icon="texture-zoom-out"
            flyout-side="above"
            label="Zoom out"
            ?disabled=${disabled}
            @click=${() => this.zoomBy(1 / kZoomStep)}
          ></jolly-tool-button>
          <span class="zoom" data-role="zoom">
            ${viewport === null ? "-" : `${viewport.percent}%`}
          </span>
          <jolly-tool-button
            data-tool="zoom-in"
            icon="texture-zoom-in"
            flyout-side="above"
            label="Zoom in"
            ?disabled=${disabled}
            @click=${() => this.zoomBy(kZoomStep)}
          ></jolly-tool-button>
        </div>
        <div class="group divided" role="group" aria-label="Sampling">
          <jolly-tool-button
            data-tool="pixelated"
            icon="texture-pixelated"
            flyout-side="above"
            label="Sharp pixels"
            ?active=${this.#pixelated}
            ?disabled=${disabled}
            @click=${() => {
              this.#pixelated = !this.#pixelated;
              this.requestUpdate();
            }}
          ></jolly-tool-button>
        </div>
      </jolly-rail>
    `;
  }

  #layout(): void {
    const picture = this.#preview.current?.picture ?? null;
    if (picture === null) {
      this.#viewport = null;
    }
    else if (this.#hasSize()) {
      this.#viewport = this.#viewport?.adaptTo(this.#size, picture) ??
        TextureViewport.fit(this.#size, picture);
    }
    this.requestUpdate();
  }

  #place(
    placement: (view: ViewSize, image: ViewSize) => TextureViewport
  ): void {
    const picture = this.#preview.current?.picture ?? null;
    if (picture !== null && this.#hasSize()) {
      this.#viewport = placement(this.#size, picture);
    }
    this.requestUpdate();
  }

  #hasSize(): boolean {
    return this.#size.width > 0 && this.#size.height > 0;
  }

  #onWheel = (
    event: WheelEvent
  ): void => {
    if (this.#viewport === null) {
      return;
    }

    event.preventDefault();
    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ?
      event.deltaY * kLinePixels :
      event.deltaY;
    const speed = event.ctrlKey ? kPinchZoomSpeed : kWheelZoomSpeed;
    this.zoomBy(Math.exp(-delta * speed), this.#pointIn(event));
  };

  #onPointerDown = (
    event: PointerEvent
  ): void => {
    if (this.#viewport === null || event.button > 1) {
      return;
    }

    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.#drag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    this.requestUpdate();
  };

  #onPointerMove = (
    event: PointerEvent
  ): void => {
    const drag = this.#drag;
    if (
      drag === null ||
      drag.pointerId !== event.pointerId ||
      this.#viewport === null
    ) {
      return;
    }

    this.#viewport = this.#viewport.panBy(
      event.clientX - drag.x,
      event.clientY - drag.y
    );
    this.#drag = {
      pointerId: drag.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    this.requestUpdate();
  };

  #onPointerUp = (
    event: PointerEvent
  ): void => {
    if (this.#drag?.pointerId === event.pointerId) {
      this.#drag = null;
      this.requestUpdate();
    }
  };

  #pointIn(
    event: MouseEvent
  ): ViewPoint {
    const rect = this.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}

customElements.define("jolly-texture-stage", TextureStage);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-texture-stage": TextureStage;
  }
}
