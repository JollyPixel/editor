// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "@jolly-pixel/pixel-draw.renderer";
import {
  ambientThemeMode,
  resolveThemeColor,
  themeStyles,
  type JollyTabChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "../color/ColorSwatch.ts";
import { panelStyles } from "./PixelDrawPanel.styles.ts";
import { railButtonStyles } from "../mode-rail/rail-button.styles.ts";
import { iconStyles } from "../common/icon.styles.ts";
import { UvToolbarController } from "../toolbars/UvToolbarController.ts";
import { SelectToolbarController } from "../toolbars/SelectToolbarController.ts";
import { TextureDropController } from "../toolbars/TextureDropController.ts";
import { HistoryFileToolbarController } from "../toolbars/HistoryFileToolbarController.ts";
import { ToolOptionsController } from "../toolbars/ToolOptionsController.ts";
import { showImportTextureDialog } from "../toolbars/importTextureDialog.ts";
import {
  ColorController,
  type ColorPickedDetail
} from "../color/ColorController.ts";
import { assertElement } from "../../utils/dom.ts";
import { type ModeVariantDetail } from "../mode-rail/ModeRail.ts";
import {
  isUvAccess,
  modeAllowedBy,
  type UvAccess
} from "./uvAccess.ts";
import { TextureBusy } from "./TextureBusy.ts";
import {
  isTextureImportPolicy,
  nextActiveTextureId,
  suggestTextureName,
  textureCanvasOptions,
  type PixelDrawInitializeOptions,
  type PixelDrawTextureOptions,
  type TextureAddRequestDetail,
  type TextureChangeDetail,
  type TextureCloseRequestDetail,
  type TextureImportOutcome,
  type TextureImportPolicy,
  type TextureImportRequest
} from "./textures.ts";
import "../color/ColorPickerRail.ts";
import "../color/ColorDock.ts";

// CONSTANTS
const kDefaultTextureId = "default";
const kDefaultTextureName = "Texture";

export type ThemeMode = "light" | "dark" | "auto";

export interface PixelDrawTexture {
  readonly id: string;
  readonly name: string;
  readonly tooltip: string;
  readonly canvas: PixelArtCanvas;
}

interface TextureEntry {
  id: string;
  name: string;
  tooltip: string;
  host: HTMLDivElement;
  canvas: PixelArtCanvas | null;
}

function isThemeMode(
  value: string
): value is ThemeMode {
  return value === "light" || value === "dark" || value === "auto";
}

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = [
    themeStyles,
    iconStyles,
    railButtonStyles,
    panelStyles
  ];

  @property({ type: Boolean, attribute: "allow-uv-create-delete" })
  declare allowUvCreateDelete: boolean;

  @property({
    type: String,
    reflect: true,
    attribute: "uv-access",
    converter: {
      fromAttribute(value) {
        return (value !== null && isUvAccess(value)) ? value : "edit";
      }
    }
  })
  declare uvAccess: UvAccess;

  @property({
    type: String,
    reflect: true,
    converter: {
      fromAttribute(value) {
        return (value !== null && isThemeMode(value)) ? value : "auto";
      }
    }
  })
  declare theme: ThemeMode;

  @property({ type: Boolean, reflect: true, attribute: "color-docked" })
  declare colorDocked: boolean;

  @property({
    type: String,
    reflect: true,
    attribute: "texture-import-policy",
    converter: {
      fromAttribute(value) {
        return (value !== null && isTextureImportPolicy(value)) ? value : "replace";
      }
    }
  })
  declare textureImportPolicy: TextureImportPolicy;

  readonly #busy = new TextureBusy(this);
  readonly #uvToolbar = new UvToolbarController(this);
  readonly #selectToolbar = new SelectToolbarController(this);
  readonly #textureDrop = new TextureDropController(this, {
    importTexture: (request) => this.#importTexture(request),
    policy: () => this.textureImportPolicy,
    busy: this.#busy
  });
  readonly #historyFile = new HistoryFileToolbarController(
    this,
    {
      importTexture: (request) => this.#importTexture(request),
      busy: this.#busy
    }
  );
  readonly #toolOptions = new ToolOptionsController(this);
  readonly #colors = new ColorController(this);

  readonly #textures = new Map<string, TextureEntry>();
  #active: TextureEntry | null = null;
  #baseOptions: PixelArtCanvasOptions | null = null;
  #prefersDarkQuery: MediaQueryList | null = null;
  #canvasHostObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.allowUvCreateDelete = false;
    this.uvAccess = "edit";
    this.theme = "auto";
    this.colorDocked = false;
    this.textureImportPolicy = "replace";
  }

  get canvasManager(): PixelArtCanvas | null {
    return this.#active?.canvas ?? null;
  }

  get textures(): PixelDrawTexture[] {
    const textures: PixelDrawTexture[] = [];
    for (const { id, name, tooltip, canvas } of this.#textures.values()) {
      if (canvas !== null) {
        textures.push({
          id,
          name,
          tooltip,
          canvas
        });
      }
    }

    return textures;
  }

  get activeTextureId(): string | null {
    return this.#active?.id ?? null;
  }

  set activeTextureId(
    id: string
  ) {
    const entry = this.#entry(id);
    if (entry !== this.#active) {
      this.#activate(entry);
      this.#emitTextureChange(entry.id);
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.#prefersDarkQuery.addEventListener("change", this.#onPrefersColorSchemeChange);
    this.#syncAmbientTheme();

    const stageEl = this.renderRoot.querySelector<HTMLDivElement>(".stage");
    const canvas = this.canvasManager;
    if (canvas && stageEl) {
      this.#attachControllers(canvas, stageEl);
      this.requestUpdate();
    }
    this.#observeCanvasHost();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#prefersDarkQuery?.removeEventListener("change", this.#onPrefersColorSchemeChange);
    this.#prefersDarkQuery = null;
    this.#canvasHostObserver?.disconnect();
    this.#canvasHostObserver = null;
    this.#busy.clear();
    queueMicrotask(() => {
      if (this.isConnected) {
        return;
      }

      this.#destroyTextures();
    });
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("colorDocked")) {
      this.#colors.docked = this.colorDocked;
    }
    if (changedProperties.has("uvAccess")) {
      this.#applyUvAccess();
    }
  }

  override firstUpdated(
    changedProperties: PropertyValues<this>
  ): void {
    super.firstUpdated(changedProperties);
    this.#observeCanvasHost();
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    super.updated(changedProperties);
    if (changedProperties.has("theme")) {
      this.#syncCanvasBackground();
    }
  }

  async initialize(
    options: PixelDrawInitializeOptions = {}
  ): Promise<PixelArtCanvas> {
    await this.updateComplete;

    this.#destroyTextures();
    this.#baseOptions = textureCanvasOptions({}, options);
    const canvas = this.#createTexture({
      ...options,
      id: options.id ?? kDefaultTextureId,
      name: options.name ?? kDefaultTextureName
    });

    this.#applyUvAccess();
    this.#syncCanvasBackground();
    this.requestUpdate();
    await this.updateComplete;
    this.setAttribute("data-ready", "");

    return canvas;
  }

  addTexture(
    options: PixelDrawTextureOptions
  ): PixelArtCanvas {
    if (this.#baseOptions === null) {
      throw new Error("PixelDrawPanel: call initialize() before addTexture()");
    }

    const canvas = this.#createTexture({
      ...textureCanvasOptions(this.#baseOptions, options),
      id: options.id,
      name: options.name,
      tooltip: options.tooltip
    });
    this.#syncCanvasBackground();
    this.requestUpdate();
    this.#emitTextureChange(options.id);

    return canvas;
  }

  removeTexture(
    id: string
  ): void {
    const entry = this.#entry(id);
    if (this.#textures.size === 1) {
      throw new Error(`PixelDrawPanel: cannot remove "${id}", the last texture`);
    }

    const nextId = nextActiveTextureId(
      [...this.#textures.keys()],
      id,
      this.activeTextureId
    );
    this.#textures.delete(id);

    const next = nextId === null ? undefined : this.#textures.get(nextId);
    if (entry === this.#active && next !== undefined) {
      this.#activate(next);
      this.#emitTextureChange(next.id);
    }

    entry.canvas?.destroy();
    entry.host.remove();
    this.requestUpdate();
  }

  renameTexture(
    id: string,
    name: string
  ): void {
    this.#entry(id).name = name;
    this.requestUpdate();
  }

  onResize(): void {
    this.canvasManager?.onResize();
  }

  #observeCanvasHost(): void {
    if (
      this.#canvasHostObserver !== null ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const canvasHostEl = this.renderRoot.querySelector<HTMLDivElement>(
      ".canvas-host"
    );
    if (canvasHostEl === null) {
      return;
    }

    this.#canvasHostObserver = new ResizeObserver(() => this.onResize());
    this.#canvasHostObserver.observe(canvasHostEl);
  }

  readonly #onColorPicked = (
    event: CustomEvent<ColorPickedDetail>
  ): void => {
    this.#colors.onColorPicked(event.detail);
    this.#toolOptions.disarmPickColor();
    this.requestUpdate();
  };

  readonly #onPrefersColorSchemeChange = (): void => {
    if (this.theme === "auto") {
      this.#syncCanvasBackground();
    }
  };

  #onDockToggle(): void {
    this.colorDocked = !this.colorDocked;

    const customEvent = new CustomEvent<boolean>("color-docked-change", {
      bubbles: true,
      composed: true,
      detail: this.colorDocked
    });
    this.dispatchEvent(customEvent);
  }

  #entry(
    id: string
  ): TextureEntry {
    const entry = this.#textures.get(id);
    if (entry === undefined) {
      throw new Error(`PixelDrawPanel: unknown texture "${id}"`);
    }

    return entry;
  }

  #createTexture(
    options: PixelDrawTextureOptions
  ): PixelArtCanvas {
    const { id, name, tooltip, ...canvasOptions } = options;
    if (this.#textures.has(id)) {
      throw new Error(`PixelDrawPanel: texture "${id}" already exists`);
    }

    const canvasHostEl = assertElement(
      this.renderRoot.querySelector<HTMLDivElement>(".canvas-host"),
      "PixelDrawPanel: .canvas-host element not found"
    );
    const stageEl = assertElement(
      this.renderRoot.querySelector<HTMLDivElement>(".stage"),
      "PixelDrawPanel: .stage element not found"
    );

    const host = document.createElement("div");
    host.className = "texture-host";
    host.dataset.textureId = id;
    canvasHostEl.append(host);

    const entry: TextureEntry = {
      id,
      name,
      tooltip: tooltip ?? "",
      host,
      canvas: null
    };
    const previous = this.#active;
    this.#textures.set(id, entry);
    this.#showHost(entry);
    this.#active = entry;

    let canvas: PixelArtCanvas;
    try {
      canvas = new PixelArtCanvas(host, {
        ...canvasOptions,
        defaultMode: modeAllowedBy(canvasOptions.defaultMode ?? "paint", this.uvAccess),
        backgroundColor: this.#canvasBackground() || canvasOptions.backgroundColor,
        onHistoryChange: (state) => {
          if (this.#active === entry) {
            this.#historyFile.onHistoryChange(state);
          }
          canvasOptions.onHistoryChange?.(state);
        },
        onModeChange: (mode, previousMode) => {
          if (this.#active === entry) {
            this.#toolOptions.onCanvasModeChange(mode);
            this.#selectToolbar.onModeChange(mode === "select");
          }
          canvasOptions.onModeChange?.(mode, previousMode);
        },
        onClipboardResult: (result) => {
          if (this.#active === entry) {
            this.#selectToolbar.onClipboardResult(result);
          }
          canvasOptions.onClipboardResult?.(result);
        }
      });
    }
    catch (error) {
      this.#textures.delete(id);
      host.remove();
      this.#active = previous;
      if (previous !== null) {
        this.#showHost(previous);
      }

      throw error;
    }

    entry.canvas = canvas;
    this.#attachControllers(canvas, stageEl);
    canvas.onResize();

    return canvas;
  }

  #activate(
    entry: TextureEntry
  ): void {
    const stageEl = this.renderRoot.querySelector<HTMLDivElement>(".stage");
    this.#active = entry;
    this.#showHost(entry);
    if (entry.canvas !== null && stageEl !== null) {
      this.#attachControllers(entry.canvas, stageEl);
      entry.canvas.onResize();
    }
    this.requestUpdate();
  }

  #showHost(
    visible: TextureEntry
  ): void {
    for (const entry of this.#textures.values()) {
      entry.host.hidden = entry !== visible;
    }
  }

  #destroyTextures(): void {
    for (const entry of this.#textures.values()) {
      entry.canvas?.destroy();
      entry.host.remove();
    }
    this.#textures.clear();
    this.#active = null;
    this.#baseOptions = null;
  }

  #emitTextureChange(
    id: string
  ): void {
    this.dispatchEvent(new CustomEvent<TextureChangeDetail>("texture-change", {
      bubbles: true,
      composed: true,
      detail: { id }
    }));
  }

  async #importTexture(
    request: TextureImportRequest
  ): Promise<TextureImportOutcome> {
    const name = suggestTextureName(request.fileName);
    const choice = this.textureImportPolicy === "ask" ?
      await showImportTextureDialog({ name }) :
      this.textureImportPolicy;

    if (choice === null) {
      return "cancelled";
    }
    if (choice === "add") {
      const release = this.#busy.begin(request.origin, `Adding ${name}`);
      const work: Promise<unknown>[] = [];
      this.dispatchEvent(new CustomEvent<TextureAddRequestDetail>("texture-add-request", {
        bubbles: true,
        composed: true,
        detail: {
          name,
          source: request.source,
          origin: request.origin,
          respondWith(promise) {
            work.push(promise);
          }
        }
      }));

      if (work.length === 0) {
        release();
      }
      else {
        void Promise.allSettled(work).then(release);
      }

      return "requested";
    }

    const isLive = [...this.#textures.values()].some(
      (entry) => entry.canvas === request.canvas
    );
    if (!isLive) {
      return "cancelled";
    }

    request.canvas.texture = request.source;
    request.canvas.centerTexture();

    return "replaced";
  }

  #onTextureTabClose(
    event: CustomEvent<JollyTabChangeDetail>
  ): void {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent<TextureCloseRequestDetail>("texture-close-request", {
      bubbles: true,
      composed: true,
      detail: { id: event.detail.value }
    }));
  }

  #attachControllers(
    canvas: PixelArtCanvas,
    stageEl: HTMLDivElement
  ): void {
    this.#toolOptions.attach(canvas);
    this.#colors.attach(canvas);
    this.#historyFile.attach(canvas);
    this.#uvToolbar.attach(canvas);
    this.#selectToolbar.attach(canvas);
    this.#textureDrop.attach(canvas, stageEl);
  }

  #applyUvAccess(): void {
    const mode = modeAllowedBy(this.#toolOptions.mode, this.uvAccess);
    if (mode !== this.#toolOptions.mode) {
      this.#toolOptions.setMode(mode);
    }
    if (this.uvAccess === "none" && this.#toolOptions.fillUvClip) {
      this.#toolOptions.setFillUvClip(false);
    }
  }

  #syncAmbientTheme(): void {
    const ambient = ambientThemeMode(this);
    if (ambient === null) {
      delete this.dataset.ambientTheme;
    }
    else {
      this.dataset.ambientTheme = ambient;
    }
  }

  #syncCanvasBackground(): void {
    const canvasBg = this.#canvasBackground();
    if (!canvasBg) {
      return;
    }

    for (const { canvas } of this.#textures.values()) {
      if (canvas !== null) {
        canvas.backgroundColor = canvasBg;
      }
    }
  }

  #canvasBackground(): string {
    return resolveThemeColor(this, "--color-canvas-bg");
  }

  #onModeVariantChange(
    { mode, value }: ModeVariantDetail
  ): void {
    this.#toolOptions.setMode(mode);
    if (mode === "fill") {
      this.#toolOptions.setFillGlobal(value);
    }
    else if (mode === "select") {
      this.#toolOptions.setSelectShape(value);
    }
  }

  #renderBusy() {
    const busy = this.#busy.state;
    if (busy === null) {
      return nothing;
    }

    return html`
      <div
        class="stage-busy"
        part="stage-busy"
        role="status"
        aria-live="polite"
      >
        <jolly-spinner></jolly-spinner>
        <span>${busy.label}</span>
      </div>
    `;
  }

  #renderTextureTabs() {
    if (this.#textures.size < 2) {
      return nothing;
    }

    return html`
      <jolly-tabs
        class="texture-tabs"
        part="texture-tabs"
        .value=${this.activeTextureId ?? ""}
        @jolly-tab-change=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          this.activeTextureId = event.detail.value;
        }}
        @jolly-tab-close=${(event: CustomEvent<JollyTabChangeDetail>) => {
          this.#onTextureTabClose(event);
        }}
      >
        ${repeat(
          this.#textures.values(),
          (entry) => entry.id,
          (entry) => html`
            <jolly-tab
              .value=${entry.id}
              .label=${entry.name}
              .tooltip=${entry.tooltip}
              closable
            ></jolly-tab>
          `
        )}
      </jolly-tabs>
    `;
  }

  override render() {
    return html`
      <div class="rail" part="rail">
        <mode-rail
          .mode=${this.#toolOptions.mode}
          .pickColorArmed=${this.#toolOptions.pickColorArmed}
          .fillGlobal=${this.#toolOptions.fillGlobal}
          .fillUvClip=${this.#toolOptions.fillUvClip}
          .selectShape=${this.#toolOptions.selectShape}
          .uvAccess=${this.uvAccess}
          @mode-change=${(event: CustomEvent<Mode>) => this.#toolOptions.setMode(event.detail)}
          @pick-color-toggle=${() => this.#toolOptions.togglePickColor()}
          @fill-uv-clip-change=${(event: CustomEvent<boolean>) => {
            this.#toolOptions.setMode("fill");
            this.#toolOptions.setFillUvClip(event.detail);
          }}
          @mode-variant-change=${(event: CustomEvent<ModeVariantDetail>) => {
            this.#onModeVariantChange(event.detail);
          }}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#colors.foreground}
          .background=${this.#colors.background}
          .docked=${this.colorDocked}
          @foreground-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.onForegroundChange(event);
          }}
          @background-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.onBackgroundChange(event);
          }}
          @swap=${() => this.#colors.swap()}
          @dock-toggle=${() => this.#onDockToggle()}
        ></color-picker-rail>
      </div>

      <div class="workspace" part="workspace">
        ${this.#renderTextureTabs()}
        <div class="stage" part="stage">
          <div class="canvas-host" part="canvas-host"></div>
          ${this.#renderBusy()}
          ${this.#textureDrop.render()}
          ${this.#toolOptions.render()}
          ${this.#selectToolbar.render(this.#toolOptions.mode === "select")}
          ${this.#uvToolbar.render(
            this.#toolOptions.mode === "uv" && this.uvAccess === "edit",
            this.allowUvCreateDelete
          )}
          ${this.#historyFile.render(
            this.uvAccess === "view" ? this.#uvToolbar.renderVisibilityToggles() : nothing
          )}
        </div>
        ${this.colorDocked ? html`
          <color-dock
            class="color-dock"
            part="color-dock"
            .color=${this.#colors.foreground.hex}
            .opacity=${this.#colors.foreground.opacity}
            @color-change=${(event: CustomEvent<ColorChangeDetail>) => {
              this.#colors.onActiveChange(event);
            }}
          ></color-dock>
        ` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }

  interface HTMLElementEventMap {
    colorpicked: CustomEvent<ColorPickedDetail>;
    "color-docked-change": CustomEvent<boolean>;
    "texture-add-request": CustomEvent<TextureAddRequestDetail>;
    "texture-change": CustomEvent<TextureChangeDetail>;
    "texture-close-request": CustomEvent<TextureCloseRequestDetail>;
  }
}
