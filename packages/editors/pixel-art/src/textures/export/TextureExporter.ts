// Import Third-party Dependencies
import {
  html,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { PopoverController } from "@jolly-pixel/ui";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { encodePng } from "@jolly-pixel/image";

// Import Internal Dependencies
import {
  NormalMapPng,
  type NormalMapConvention
} from "../../normal/NormalMapPng.ts";
import { PngFile } from "../../shared/PngFile.ts";
import { renderIcon } from "../../shared/icons.ts";
import { renderRailButton } from "../../shared/railButton.ts";

// CONSTANTS
const kAlbedoFileName = "texture.png";
const kNormalFormats: readonly {
  format: NormalMapExportFormat;
  convention: NormalMapConvention;
  label: string;
}[] = [
  {
    format: "normal-opengl",
    convention: "opengl",
    label: "Normal map — OpenGL (Y+)"
  },
  {
    format: "normal-directx",
    convention: "directx",
    label: "Normal map — DirectX (Y-)"
  }
];

type NormalMapExportFormat = "normal-opengl" | "normal-directx";

export type TextureExportFormat = "albedo" | NormalMapExportFormat;

export type TextureExporterHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

export interface TextureExporterOptions {
  canvas: () => PixelArtCanvas | null;
  normalMap: () => boolean;
}

export class TextureExporter {
  readonly #host: TextureExporterHost;
  readonly #options: TextureExporterOptions;
  readonly #popup: PopoverController;

  constructor(
    host: TextureExporterHost,
    options: TextureExporterOptions
  ) {
    this.#host = host;
    this.#options = options;
    this.#popup = new PopoverController(host, {
      anchor: () => this.#element("[part=\"export-button\"]"),
      popover: () => this.#element("[part=\"export-menu\"]"),
      side: "above",
      align: "start"
    });
  }

  get #normalsAvailable(): boolean {
    return this.#options.normalMap() &&
      (this.#options.canvas()?.document.normalMap ?? null) !== null;
  }

  async capture(
    format: TextureExportFormat
  ): Promise<PngFile | null> {
    const canvas = this.#options.canvas();
    if (canvas === null) {
      return null;
    }
    const normal = kNormalFormats.find((entry) => entry.format === format);
    if (normal === undefined) {
      return TextureExporter.#captureAlbedo(canvas);
    }
    if (!this.#normalsAvailable) {
      return null;
    }

    const png = NormalMapPng.capture(
      canvas.document.normals,
      normal.convention
    );

    return new PngFile(NormalMapPng.FILE_NAME, await png.encode());
  }

  async export(
    format: TextureExportFormat
  ): Promise<void> {
    this.#popup.hide();
    const file = await this.capture(format);
    file?.download();
  }

  render(): TemplateResult {
    if (!this.#normalsAvailable) {
      return renderRailButton({
        part: "export-button",
        label: "Export texture",
        tooltip: "Export",
        icon: "export",
        onClick: () => void this.export("albedo")
      });
    }

    return html`
      <button
        class="rail-btn uv-state-trigger"
        part="export-button"
        popovertarget="export-menu"
        aria-haspopup="menu"
        aria-expanded=${this.#popup.open}
        aria-label="Export textures"
      >
        ${renderIcon("export")}
        ${renderIcon("chevronDown")}
        <span class="tooltip">Export textures</span>
      </button>
      <div
        class="uv-state-menu"
        part="export-menu"
        id="export-menu"
        role="menu"
        popover
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        <button
          class="uv-state-option"
          part="export-albedo-button"
          role="menuitem"
          @click=${() => void this.export("albedo")}
        >
          <span>Albedo texture</span>
        </button>
        ${kNormalFormats.map(({ format, label }) => html`
          <button
            class="uv-state-option"
            part="export-${format}"
            role="menuitem"
            @click=${() => void this.export(format)}
          >
            <span>${label}</span>
          </button>
        `)}
      </div>
    `;
  }

  static async #captureAlbedo(
    canvas: PixelArtCanvas
  ): Promise<PngFile | null> {
    const texture = canvas.textureCanvas();
    const context = texture.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    const { width, height } = texture;
    const { data } = context.getImageData(0, 0, width, height);

    return new PngFile(kAlbedoFileName, await encodePng({
      width,
      height,
      data
    }));
  }

  #element(
    selector: string
  ): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(selector);
  }
}
