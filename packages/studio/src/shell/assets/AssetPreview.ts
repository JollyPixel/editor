// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import type { IconName } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/icon";

// Import Internal Dependencies
import type { AssetPreviewTarget } from "../../catalog/AssetSummary.ts";
import type { AssetPreviewCache } from "./AssetPreviewCache.ts";
import { AssetPreviewController } from "./AssetPreviewController.ts";

// CONSTANTS
const kFallbackIcon: IconName = "file";

@customElement("asset-preview")
export class AssetPreview extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 160px;
    }

    .frame {
      display: flex;
      position: relative;
      box-sizing: border-box;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--jolly-space-2);
      height: 100%;
      padding: var(--jolly-space-3);
      overflow: hidden;
      border-radius: var(--jolly-radius-sm);
      background: var(--jolly-surface-sunken);
      color: var(--jolly-text-muted);
      text-align: center;

      --jolly-icon-size: 48px;
    }

    .frame.image {
      background-color: var(--jolly-surface);
      background-image: conic-gradient(
        var(--jolly-surface-sunken) 25%,
        transparent 0 50%,
        var(--jolly-surface-sunken) 0 75%,
        transparent 0
      );
      background-size: 16px 16px;
    }

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      image-rendering: pixelated;
    }

    .size {
      position: absolute;
      inset-block-end: var(--jolly-space-1);
      inset-inline-end: var(--jolly-space-1);
      padding-inline: var(--jolly-space-1);
      border-radius: var(--jolly-radius-sm);
      background: color-mix(in oklab, var(--jolly-surface) 85%, transparent);
      font-size: 0.85em;
      font-variant-numeric: tabular-nums;
    }
  `;

  @property({ attribute: false })
  declare previews: AssetPreviewCache | null;

  @property({ attribute: false })
  declare target: AssetPreviewTarget | null;

  @property()
  declare icon: IconName;

  @state()
  declare _size: ImageSize | null;

  #preview = new AssetPreviewController(this);

  constructor() {
    super();
    this.previews = null;
    this.target = null;
    this.icon = kFallbackIcon;
    this._size = null;
  }

  protected override willUpdate(): void {
    this.#preview.show(this.previews, this.target);
  }

  override render(): TemplateResult {
    const { url } = this.#preview;
    if (url === null) {
      return html`
        <div class="frame">
          <jolly-icon name=${this.icon}></jolly-icon>
          <slot></slot>
        </div>
      `;
    }

    return html`
      <div class="frame image">
        <img src=${url} alt="" @load=${this.#onLoad}>
        ${this.#size(url)}
      </div>
    `;
  }

  #size(
    url: string
  ): TemplateResult | typeof nothing {
    const size = this._size;

    return size === null || size.url !== url ?
      nothing :
      html`<span class="size">${size.width} × ${size.height}</span>`;
  }

  #onLoad(
    event: Event
  ): void {
    const image = event.currentTarget;
    if (image instanceof HTMLImageElement) {
      this._size = {
        url: image.getAttribute("src") ?? "",
        width: image.naturalWidth,
        height: image.naturalHeight
      };
    }
  }
}

interface ImageSize {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

declare global {
  interface HTMLElementTagNameMap {
    "asset-preview": AssetPreview;
  }
}
