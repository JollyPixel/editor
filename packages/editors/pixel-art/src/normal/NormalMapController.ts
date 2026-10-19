// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import type {
  PixelArtCanvas,
  TextureView
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";
import { renderRailButton } from "../shared/railButton.ts";
import type { DockSlot } from "../panel/DockSlot.ts";
import type { TextureEvents } from "../textures/TextureSet.ts";

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

export interface NormalMapControllerOptions {
  canvas: () => PixelArtCanvas | null;
  canvases: () => Iterable<PixelArtCanvas>;
  docks: DockSlot;
  events: TextureEvents;
  locked: () => boolean;
}

export class NormalMapController {
  readonly #host: ReactiveControllerHost;
  readonly #options: NormalMapControllerOptions;

  constructor(
    host: ReactiveControllerHost,
    options: NormalMapControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
    options.events.subscribe("active-change", () => {
      if (this.view === "normal") {
        options.docks.show("normal-map");
      }
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

  hostUpdate(): void {
    const canvas = this.#canvas();
    if (canvas?.document.normalMap === null &&
      canvas.textureView === "normal") {
      canvas.textureView = "albedo";
    }
  }

  disable(): void {
    this.#options.docks.hide("normal-map");
    for (const canvas of this.#options.canvases()) {
      canvas.textureView = "albedo";
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

    if (doc.normalMap.findZone(regionId) === undefined) {
      doc.assignNormalMapZone({
        regionId,
        settings: {}
      });
    }
    this.#options.docks.show("normal-map");
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
        .locked=${this.#options.locked()}
      ></normal-map-dock>
    `;
  }

  renderViewSwitch(): TemplateResult {
    const current = this.view;
    const enabled = (this.#canvas()?.document.normalMap ?? null) !== null;

    return html`
      ${enabled ? html`
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
            aria-label=${label}
            aria-checked=${view === current}
            @click=${() => {
              this.view = view;
            }}
          >${renderIcon(icon)}<span>${label}</span></button>
        `)}
      </div>
      ` : nothing}
      ${renderRailButton({
        part: "normal-map-dock-button",
        label: "Normal map settings",
        icon: "sliders",
        pressed: this.#options.docks.isOpen("normal-map"),
        onClick: () => this.#options.docks.toggle("normal-map")
      })}
    `;
  }

  renderOverrideButton(): TemplateResult | typeof nothing {
    const doc = this.#canvas()?.document;
    if (
      !doc ||
      doc.normalMap === null ||
      this.#options.locked()
    ) {
      return nothing;
    }

    const regionId = doc.uv.selectedRegionId;

    return renderRailButton({
      part: "uv-override-normal-button",
      label: "Override normal map",
      tooltip: "Override normal map for this region",
      icon: "normalMap",
      disabled: regionId === null,
      onClick: () => this.overrideSelectedRegion()
    });
  }

  #canvas(): PixelArtCanvas | null {
    return this.#options.canvas();
  }
}
