// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import { PopoverController } from "@jolly-pixel/ui";
import type {
  PixelArtCanvas,
  TextureView
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  NormalMapPng,
  type NormalMapConvention
} from "./NormalMapPng.ts";
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";
import { renderRailButton } from "../shared/railButton.ts";
import type { DockSlot } from "../panel/DockSlot.ts";

// CONSTANTS
const kViews: readonly {
  view: TextureView;
  label: string;
  icon: IconName;
  tooltip: string;
}[] = [
  {
    view: "albedo",
    label: "Albedo",
    icon: "albedo",
    tooltip: "Albedo: the painted colours"
  },
  {
    view: "normal",
    label: "Normal",
    icon: "normalMap",
    tooltip: "Normal map, generated from the albedo"
  }
];
const kConventions: readonly {
  convention: NormalMapConvention;
  label: string;
}[] = [
  {
    convention: "opengl",
    label: "OpenGL (Y+)"
  },
  {
    convention: "directx",
    label: "DirectX (Y-)"
  }
];

export type NormalMapHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

export interface NormalMapControllerOptions {
  canvas: () => PixelArtCanvas | null;
  canvases: () => Iterable<PixelArtCanvas>;
  docks: DockSlot;
}

export class NormalMapController {
  readonly #host: NormalMapHost;
  readonly #options: NormalMapControllerOptions;
  readonly #exportPopup: PopoverController;

  constructor(
    host: NormalMapHost,
    options: NormalMapControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    this.#exportPopup = new PopoverController(host, {
      anchor: () => this.#element("[part=\"export-normal-button\"]"),
      popover: () => this.#element("[part=\"export-normal-menu\"]"),
      side: "above",
      align: "start"
    });
  }

  get view(): TextureView {
    return this.#canvas()?.textureView ?? "albedo";
  }

  set view(
    view: TextureView
  ) {
    const canvas = this.#canvas();
    if (!canvas) {
      return;
    }

    canvas.textureView = view;
    if (view === "normal") {
      this.#options.docks.show("normal-map");
    }
    this.#host.requestUpdate();
  }

  disable(): void {
    this.#options.docks.hide("normal-map");
    for (const canvas of this.#options.canvases()) {
      canvas.textureView = "albedo";
    }
  }

  onActivate(): void {
    if (this.view === "normal") {
      this.#options.docks.show("normal-map");
    }
  }

  overrideSelectedRegion(): void {
    const doc = this.#canvas()?.document;
    const regionId = doc?.uv.selectedRegionId ?? null;
    if (
      !doc ||
      regionId === null ||
      doc.normalMap === null
    ) {
      return;
    }

    if (doc.normalMap.zoneOf(regionId) === undefined) {
      doc.setNormalMapZone({
        regionId,
        settings: {}
      });
    }
    this.#options.docks.show("normal-map");
  }

  async export(
    convention: NormalMapConvention
  ): Promise<void> {
    this.#exportPopup.hide();
    const doc = this.#canvas()?.document;
    if (!doc || doc.normalMap === null) {
      return;
    }

    await NormalMapPng.capture(
      doc.normals,
      convention
    ).download();
  }

  renderDock(): TemplateResult {
    const docked = this.#options.docks.isOpen("normal-map");

    return html`
      <normal-map-dock
        class="normal-map-dock"
        part="normal-map-dock"
        ?open=${docked}
        ?inert=${!docked}
        .pixelDocument=${this.#canvas()?.document ?? null}
      ></normal-map-dock>
    `;
  }

  renderViewSwitch(): TemplateResult {
    const current = this.view;
    const disabled = this.#canvas() === null;

    return html`
      <div
        class="view-switch"
        part="texture-view-switch"
        role="radiogroup"
        aria-label="Texture view"
      >
        ${kViews.map(({ view, label, icon, tooltip }) => html`
          <button
            class="view-option"
            part="texture-view-${view}"
            role="radio"
            title=${tooltip}
            aria-checked=${view === current}
            ?disabled=${disabled}
            @click=${() => {
              this.view = view;
            }}
          >${renderIcon(icon)}<span>${label}</span></button>
        `)}
      </div>
      ${renderRailButton({
        part: "normal-map-dock-button",
        label: "Normal map settings",
        icon: "sliders",
        pressed: this.#options.docks.isOpen("normal-map"),
        onClick: () => this.#options.docks.toggle("normal-map")
      })}
    `;
  }

  renderExportButton(): TemplateResult {
    const enabled = (this.#canvas()?.document.normalMap ?? null) !== null;

    return html`
      <button
        class="rail-btn"
        part="export-normal-button"
        popovertarget="export-normal-menu"
        aria-haspopup="menu"
        aria-expanded=${this.#exportPopup.open}
        aria-label="Export normal map"
        ?disabled=${!enabled}
      >
        <span class="icon-with-badge">
          ${renderIcon("export")}
          <span class="icon-badge">${renderIcon("normalMap")}</span>
        </span>
        <span class="tooltip">Export normal map</span>
      </button>
      <div
        class="uv-state-menu"
        part="export-normal-menu"
        id="export-normal-menu"
        role="menu"
        popover
        @beforetoggle=${this.#exportPopup.onBeforeToggle}
        @toggle=${this.#exportPopup.onToggle}
      >
        ${kConventions.map(({ convention, label }) => html`
          <button
            class="uv-state-option"
            part="export-normal-${convention}"
            role="menuitem"
            @click=${() => void this.export(convention)}
          >
            <span>${label}</span>
          </button>
        `)}
      </div>
    `;
  }

  renderOverrideButton(): TemplateResult | typeof nothing {
    const doc = this.#canvas()?.document;
    if (!doc) {
      return nothing;
    }

    const regionId = doc.uv.selectedRegionId;
    const config = doc.normalMap;

    return renderRailButton({
      part: "uv-override-normal-button",
      label: "Override normal map",
      tooltip: config === null ?
        "Enable the normal map to override it per region" :
        "Override normal map for this region",
      icon: "normalMap",
      disabled: config === null || regionId === null,
      onClick: () => this.overrideSelectedRegion()
    });
  }

  #canvas(): PixelArtCanvas | null {
    return this.#options.canvas();
  }

  #element(
    selector: string
  ): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(selector);
  }
}
