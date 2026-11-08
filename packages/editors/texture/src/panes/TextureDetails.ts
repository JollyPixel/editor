// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/property-row";
import { formatBytes } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  TexturePreview,
  TextureView
} from "../image/TexturePreview.ts";

// CONSTANTS
const kUnknown = "-";

export class TextureDetails extends LitElement {
  #preview = new SubscriptionController<TexturePreview>(this, (preview) => [
    preview.subscribe("change", () => this.requestUpdate())
  ]);

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .value {
      font-variant-numeric: var(--jolly-font-numeric);
    }
  `;

  attach(
    preview: TexturePreview
  ): void {
    this.#preview.attach(preview);
  }

  override render(): TemplateResult {
    const preview = this.#preview.current;
    const file = preview?.file ?? null;
    const extension = file?.extension ?? "";
    const byteLength = file?.byteLength ?? 0;
    const rows: Array<[string, string]> = [
      ["Format", extension === "" ? kUnknown : extension.slice(1).toUpperCase()],
      ["Dimensions", dimensions(preview?.view ?? null)],
      ["File size", byteLength === 0 ? kUnknown : formatBytes(byteLength)]
    ];
    if (preview?.view.status === "header") {
      const { header } = preview.view;
      rows.push(
        ["Mip levels", String(header.levels)],
        ["Compression", header.compression]
      );
    }

    return html`
      <jolly-folder
        key="details"
        label="Details"
        storage-key="texture:folder:details"
        flush
      >
        ${rows.map(([label, value]) => html`
          <jolly-property-row label=${label} align="end">
            <span class="value">${value}</span>
          </jolly-property-row>
        `)}
      </jolly-folder>
    `;
  }
}

function dimensions(
  view: TextureView | null
): string {
  switch (view?.status) {
    case "ready":
      return `${view.picture.width} × ${view.picture.height} px`;
    case "header":
      return `${view.header.width} × ${view.header.height} px`;
    default:
      return kUnknown;
  }
}

customElements.define("jolly-texture-details", TextureDetails);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-texture-details": TextureDetails;
  }
}
