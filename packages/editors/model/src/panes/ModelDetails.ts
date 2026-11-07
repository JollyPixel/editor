// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/property-row";
import { formatBytes } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { ModelPreview } from "../preview/ModelPreview.ts";
import type { ModelStats } from "../preview/ModelStats.ts";

// CONSTANTS
const kUnknown = "-";
const kNumber = new Intl.NumberFormat("en");
const kStatRows: ReadonlyArray<readonly [string, keyof ModelStats]> = [
  ["Meshes", "meshes"],
  ["Vertices", "vertices"],
  ["Triangles", "triangles"],
  ["Materials", "materials"],
  ["Bones", "bones"],
  ["Animations", "clips"]
];

export class ModelDetails extends LitElement {
  #preview = new SubscriptionController<ModelPreview>(this, (preview) => [
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

    .missing {
      margin: 0;
      padding: var(--jolly-space-1) var(--jolly-space-2);
      color: var(--jolly-warning);
      overflow-wrap: anywhere;
    }
  `;

  attach(
    preview: ModelPreview
  ): void {
    this.#preview.attach(preview);
  }

  override render(): TemplateResult {
    const preview = this.#preview.current;
    const view = preview?.view ?? null;
    const stats = view?.status === "ready" ? view.stats : null;
    const missing = view !== null && "missing" in view ? view.missing : [];
    const file = preview?.file ?? null;
    const rows: Array<[string, string]> = [
      ["Format", file === null ? kUnknown : formatLabel(file.extension)],
      ["File size", fileSize(file?.byteLength ?? 0)],
      ...kStatRows.map(([label, key]): [string, string] => [
        label,
        stats === null ? kUnknown : kNumber.format(stats[key])
      ])
    ];

    return html`
      <jolly-folder
        key="details"
        label="Details"
        storage-key="model:folder:details"
        flush
      >
        ${rows.map(([label, value]) => html`
          <jolly-property-row label=${label} align="end">
            <span class="value">${value}</span>
          </jolly-property-row>
        `)}
        ${missing.length === 0 ? nothing : html`
          <p class="missing" role="note">
            Missing external files: ${missing.join(", ")}
          </p>
        `}
      </jolly-folder>
    `;
  }
}

function formatLabel(
  extension: string
): string {
  return extension === "" ? kUnknown : extension.slice(1).toUpperCase();
}

function fileSize(
  bytes: number
): string {
  if (bytes === 0) {
    return kUnknown;
  }

  return formatBytes(bytes);
}

customElements.define("jolly-model-details", ModelDetails);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-details": ModelDetails;
  }
}
