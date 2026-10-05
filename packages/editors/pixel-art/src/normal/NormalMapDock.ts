// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { repeat } from "lit/directives/repeat.js";
import {
  FieldBinding,
  type JollyOption
} from "@jolly-pixel/ui";
import {
  DEFAULT_NORMAL_MAP_SETTINGS,
  NORMAL_MAP_BEVEL_PROFILES,
  NORMAL_MAP_BORDERS,
  NORMAL_MAP_HEIGHTS,
  type NormalMapBevelProfile,
  type NormalMapBorder,
  type NormalMapHeight,
  type NormalMapSettings,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { NormalMapDocumentController } from "./NormalMapDocumentController.ts";
import type { NormalMapZoneRow } from "./NormalMapOverview.ts";
import { NormalMapTarget } from "./NormalMapTarget.ts";
import { normalMapDockStyles } from "./NormalMapDock.styles.ts";
import { iconStyles } from "../shared/icon.styles.ts";
import { renderIcon } from "../shared/icons.ts";

// CONSTANTS
const kHeightLabels: Record<NormalMapHeight, string> = {
  luminance: "Luminance",
  regions: "Colour regions",
  flat: "Flat"
};
const kBorderLabels: Record<NormalMapBorder, string> = {
  wrap: "Wrap",
  clamp: "Clamp",
  bevel: "Bevel"
};
const kProfileLabels: Record<NormalMapBevelProfile, string> = {
  linear: "Linear",
  round: "Round"
};
const kHeightOptions: JollyOption<NormalMapHeight>[] = NORMAL_MAP_HEIGHTS.map(
  (value) => {
    return {
      value,
      label: kHeightLabels[value]
    };
  }
);
const kBorderOptions: JollyOption<NormalMapBorder>[] = NORMAL_MAP_BORDERS.map(
  (value) => {
    return {
      value,
      label: kBorderLabels[value]
    };
  }
);
const kProfileOptions: JollyOption<NormalMapBevelProfile>[] =
  NORMAL_MAP_BEVEL_PROFILES.map((value) => {
    return {
      value,
      label: kProfileLabels[value]
    };
  });
const kLevelOptions: JollyOption<number>[] = [0, 3, 5, 7, 9, 11, 15].map(
  (value) => {
    return {
      value,
      label: value === 0 ? "Off" : String(value)
    };
  }
);
const kLevelsDescription = "Snaps surface directions to this many steps " +
  "per axis, for banded shading. Off keeps them smooth.";

type SettingKey = keyof NormalMapSettings;

function renderNote(
  text: string,
  options: { warning?: boolean; part?: string; } = {}
): TemplateResult {
  const { warning = false, part } = options;

  return html`
    <p class=${classMap({ note: true, warning })} part=${part ?? nothing}>
      <jolly-icon
        class="icon"
        name=${warning ? "warning" : "info"}
        aria-hidden="true"
      ></jolly-icon>
      <span>${text}</span>
    </p>
  `;
}

@customElement("normal-map-dock")
export class NormalMapDock extends LitElement {
  static override styles = [
    iconStyles,
    normalMapDockStyles
  ];

  @property({ attribute: false })
  declare pixelDocument: PixelDocument | null;

  @property({ type: Boolean, reflect: true })
  declare open: boolean;

  readonly #document = new NormalMapDocumentController(
    this,
    () => this.pixelDocument
  );

  readonly #enabled = new FieldBinding<boolean>(this, {
    read: () => (this.pixelDocument?.normalMap ?? null) !== null,
    write: (value) => {
      if (value) {
        this.pixelDocument?.enableNormalMap();
      }
      else {
        this.pixelDocument?.disableNormalMap();
      }
    }
  });

  readonly #off = new FieldBinding<boolean>(this, {
    read: () => this.#target()?.off ?? false,
    write: (value) => this.#target()?.switchOff(value)
  });

  readonly #height = this.#bind("height");
  readonly #invert = this.#bind("invert");
  readonly #strength = this.#bind("strength", (value) => Math.max(value, 0));
  readonly #border = this.#bind("border");
  readonly #edgeIntensity = this.#bind(
    "edgeIntensity",
    (value) => Math.max(value, 0)
  );
  readonly #levels = this.#bind("levels");
  readonly #bevelWidth = new FieldBinding<number>(this, {
    read: () => this.#settings().bevel.width,
    write: (value, last) => this.#target()?.write({
      bevel: {
        ...this.#settings().bevel,
        width: Math.max(Math.round(value), 1)
      }
    }, last)
  });
  readonly #bevelProfile = new FieldBinding<NormalMapBevelProfile>(this, {
    read: () => this.#settings().bevel.profile,
    write: (value, last) => this.#target()?.write({
      bevel: {
        ...this.#settings().bevel,
        profile: value
      }
    }, last)
  });

  constructor() {
    super();
    this.pixelDocument = null;
    this.open = false;
  }

  override shouldUpdate(): boolean {
    return this.open;
  }

  #bind<K extends SettingKey>(
    key: K,
    clamp: (value: NormalMapSettings[K]) => NormalMapSettings[K] = (value) => value
  ): FieldBinding<NormalMapSettings[K]> {
    return new FieldBinding<NormalMapSettings[K]>(this, {
      read: () => this.#settings()[key],
      write: (value, last) => {
        const patch: Partial<NormalMapSettings> = {};
        patch[key] = clamp(value);
        this.#target()?.write(patch, last);
      }
    });
  }

  #target(): NormalMapTarget | null {
    return this.pixelDocument === null ?
      null :
      NormalMapTarget.of(this.pixelDocument);
  }

  #settings(): Readonly<NormalMapSettings> {
    return this.#target()?.settings ?? DEFAULT_NORMAL_MAP_SETTINGS;
  }

  #select(
    regionId: string | null
  ): void {
    this.pixelDocument?.uv.select(regionId);
  }

  #renderSetting(
    target: NormalMapTarget,
    key: SettingKey,
    control: TemplateResult
  ): TemplateResult {
    const overridden = target.overrides(key);
    const inherited = target.zone !== null && !overridden;

    return html`
      <div
        class=${classMap({ setting: true, inherited })}
        data-setting=${key}
      >
        ${control}
        ${overridden ?
          html`
            <button
              class="reset"
              part="normal-map-reset"
              title="Use texture default"
              aria-label="Use texture default"
              @click=${() => target.reset(key)}
            ><jolly-icon class="icon" name="revert" aria-hidden="true"></jolly-icon></button>
          ` :
          nothing}
      </div>
    `;
  }

  #renderFields(
    target: NormalMapTarget
  ): TemplateResult {
    const { settings } = target;
    const defaults = target.zone === null ? DEFAULT_NORMAL_MAP_SETTINGS : undefined;
    const bevelUsed = settings.border === "bevel" || settings.height === "regions";

    return html`
      <div class="fields">
        ${this.#renderSetting(target, "height", html`
          <jolly-select
            align="end"
            label-position="auto"
            label="Height"
            .options=${kHeightOptions}
            .value=${this.#height.value}
            .default=${defaults?.height}
            @jolly-change=${this.#height.commit}
          ></jolly-select>
        `)}
        ${this.#renderSetting(target, "invert", html`
          <jolly-checkbox
            align="end"
            label-position="auto"
            label="Invert"
            .value=${this.#invert.value}
            .default=${defaults?.invert}
            @jolly-change=${this.#invert.commit}
          ></jolly-checkbox>
        `)}
        ${this.#renderSetting(target, "strength", html`
          <jolly-slider
            label-position="auto"
            label="Strength"
            min="0"
            max="10"
            step="0.1"
            .value=${this.#strength.value}
            .default=${defaults?.strength}
            @jolly-input=${this.#strength.input}
            @jolly-change=${this.#strength.commit}
          ></jolly-slider>
        `)}
        ${this.#renderSetting(target, "border", html`
          <jolly-select
            align="end"
            label-position="auto"
            label="Border"
            .options=${kBorderOptions}
            .value=${this.#border.value}
            .default=${defaults?.border}
            @jolly-change=${this.#border.commit}
          ></jolly-select>
        `)}
        ${bevelUsed ? this.#renderSetting(target, "bevel", html`
          <div class="group">
            <jolly-slider
              label-position="auto"
              label="Bevel width"
              min="1"
              max="16"
              step="1"
              .value=${this.#bevelWidth.value}
              .default=${defaults?.bevel.width}
              @jolly-input=${this.#bevelWidth.input}
              @jolly-change=${this.#bevelWidth.commit}
            ></jolly-slider>
            <jolly-select
              align="end"
              label-position="auto"
              label="Bevel profile"
              .options=${kProfileOptions}
              .value=${this.#bevelProfile.value}
              .default=${defaults?.bevel.profile}
              @jolly-change=${this.#bevelProfile.commit}
            ></jolly-select>
          </div>
        `) : nothing}
        ${this.#renderSetting(target, "edgeIntensity", html`
          <jolly-slider
            label-position="auto"
            label="Edge intensity"
            min="0"
            max="4"
            step="0.1"
            .value=${this.#edgeIntensity.value}
            .default=${defaults?.edgeIntensity}
            @jolly-input=${this.#edgeIntensity.input}
            @jolly-change=${this.#edgeIntensity.commit}
          ></jolly-slider>
        `)}
        ${this.#renderSetting(target, "levels", html`
          <jolly-select
            align="end"
            label-position="auto"
            label="Levels"
            description=${kLevelsDescription}
            description-display="tooltip"
            .options=${kLevelOptions}
            .value=${this.#levels.value}
            .default=${defaults?.levels}
            @jolly-change=${this.#levels.commit}
          ></jolly-select>
        `)}
      </div>
    `;
  }

  #renderWrapNote(
    regionId: string | null
  ): TemplateResult | typeof nothing {
    const fallback = this.#document.overview?.wrapFallback(regionId);
    if (fallback === undefined) {
      return nothing;
    }

    const { islands, remainder } = fallback;
    const notes: string[] = [];
    if (islands > 0) {
      notes.push(islands === 1 ?
        "Wrap clamps on 1 island that is not one rectangle." :
        `Wrap clamps on ${islands} islands that are not one rectangle.`);
    }
    if (remainder) {
      notes.push("Wrap clamps on pixels outside UV regions.");
    }
    if (notes.length === 0) {
      return nothing;
    }

    return renderNote(notes.join(" "), { part: "normal-map-wrap-note" });
  }

  #renderTarget(
    target: NormalMapTarget
  ): TemplateResult {
    const { zone } = target;
    if (zone === null) {
      return html`
        <h3 class="target" part="normal-map-target">Texture defaults</h3>
        ${this.#renderFields(target)}
        ${this.#renderWrapNote(null)}
      `;
    }

    const row = this.#document.overview?.zoneOf(zone.regionId);

    return html`
      <h3 class="target" part="normal-map-target">${row?.name ?? zone.regionId}</h3>
      <jolly-checkbox
        align="end"
        label="Off for this UV"
        .value=${this.#off.value}
        @jolly-change=${this.#off.commit}
      ></jolly-checkbox>
      ${target.off ?
        renderNote("Flat on every island this region touches.") :
        html`${this.#renderFields(target)}${this.#renderWrapNote(zone.regionId)}`}
    `;
  }

  #renderZone(
    row: NormalMapZoneRow,
    selectedId: string | null
  ): TemplateResult {
    const { zone, region, name, sharedWith } = row;
    const selected = zone.regionId === selectedId;

    return html`
      <li
        class=${classMap({ zone: true, selected, orphaned: region === null })}
        part="normal-map-zone"
        data-region-id=${zone.regionId}
      >
        <button
          class="zone-select"
          aria-pressed=${selected}
          ?disabled=${region === null}
          @click=${() => this.#select(zone.regionId)}
        >
          <span
            class="swatch"
            style="background: ${region?.color ?? "transparent"}"
          ></span>
          <span class="zone-name">${name}</span>
          ${zone.settings === "off" ? html`<span class="tag">Off</span>` : nothing}
        </button>
        <button
          class="zone-delete"
          part="normal-map-zone-delete"
          title="Delete zone"
          aria-label="Delete zone ${name}"
          @click=${() => this.pixelDocument?.deleteNormalMapZone(zone.regionId)}
        >${renderIcon("trash")}</button>
        ${region === null ?
          renderNote("UV region missing", { warning: true }) :
          nothing}
        ${sharedWith.length > 0 ?
          renderNote(
            `Shares pixels with ${sharedWith.join(", ")}`,
            { warning: true }
          ) :
          nothing}
      </li>
    `;
  }

  #renderZones(
    target: NormalMapTarget
  ): TemplateResult {
    const overview = this.#document.overview;
    const selectedId = this.pixelDocument?.uv.selectedRegionId ?? null;
    const zones = overview?.zones ?? [];
    const defaultsSelected = target.zone === null;

    return html`
      <div class="zones">
        ${this.#renderToggle(true)}
        <ul>
          <li class=${classMap({ zone: true, selected: defaultsSelected })}>
            <button
              class="zone-select"
              part="normal-map-defaults"
              aria-pressed=${defaultsSelected}
              @click=${() => this.#select(null)}
            >
              <span class="zone-name">Texture defaults</span>
            </button>
          </li>
          ${repeat(
            zones,
            (row) => row.zone.regionId,
            (row) => this.#renderZone(row, selectedId)
          )}
        </ul>
        ${zones.length === 0 ?
          renderNote("Select a UV region and use Override normal map.") :
          nothing}
      </div>
    `;
  }

  #renderToggle(
    enabled: boolean
  ): TemplateResult {
    return html`
      <jolly-checkbox
        class="toggle"
        align="end"
        part="normal-map-enable"
        label="Normal map"
        .value=${enabled}
        ?disabled=${this.pixelDocument === null}
        @jolly-change=${this.#enabled.commit}
      ></jolly-checkbox>
    `;
  }

  override render() {
    const target = this.#target();
    if (target === null) {
      return html`
        <div class="body">
          <div class="zones">${this.#renderToggle(false)}</div>
          ${renderNote("Generates surface directions from the texture pixels.")}
        </div>
      `;
    }

    return html`
      <div class="body">
        ${this.#renderZones(target)}
        <div class="settings">${this.#renderTarget(target)}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "normal-map-dock": NormalMapDock;
  }
}
