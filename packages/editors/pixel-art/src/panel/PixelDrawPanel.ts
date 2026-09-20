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
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions,
  Mode
} from "@jolly-pixel/pixel-draw.renderer";
import {
  ambientThemeMode,
  resolveThemeColor,
  themeStyles,
  type JollyTabChangeDetail,
  type ResolvedThemeMode,
  type TabsVariant
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "../color/ColorSwatch.ts";
import { panelStyles } from "./PixelDrawPanel.styles.ts";
import { railButtonStyles } from "../shared/railButton.styles.ts";
import { iconStyles } from "../shared/icon.styles.ts";
import { UvToolbarController } from "../uv/UvToolbarController.ts";
import { SelectToolbarController } from "../tools/SelectToolbarController.ts";
import { TextureDropController } from "../textures/import/TextureDropController.ts";
import { renderHistoryFileToolbar } from "./historyFileToolbar.ts";
import { renderBrushSizeOverlay } from "../tools/brushSizeOverlay.ts";
import {
  ColorController,
  type ColorPickedDetail
} from "../color/ColorController.ts";
import { assertElement } from "../shared/dom.ts";
import {
  UvAccessPolicy,
  type UvAccess
} from "../uv/UvAccessPolicy.ts";
import {
  applyToolOption,
  DEFAULT_TOOL_OPTIONS,
  readToolOptions,
  type ToolOption
} from "../tools/toolOptions.ts";
import { TextureSet } from "../textures/TextureSet.ts";
import { TextureImporter } from "../textures/import/TextureImporter.ts";
import {
  isTextureImportPolicy,
  isTextureTabsMode,
  textureCanvasOptions,
  type AddTextureOptions,
  type PixelDrawInitializeOptions,
  type PixelDrawTextureOptions,
  type TextureAddRequestDetail,
  type TextureChangeDetail,
  type TextureChangeSource,
  type TextureCloseRequestDetail,
  type TextureEditRequestDetail,
  type TextureImportPolicy,
  type TextureTabsMode,
  type TextureUpdate
} from "../textures/textures.ts";
import "../color/ColorPickerRail.ts";
import "../color/ColorDock.ts";

// CONSTANTS
const kDefaultTextureId = "default";
const kDefaultTextureName = "Texture";

export type ThemeMode = "light" | "dark" | "auto";

export interface CanvasHoverChangeDetail {
  hovering: boolean;
}

export interface PixelDrawTexture {
  readonly id: string;
  readonly name: string;
  readonly tooltip: string;
  readonly badge: string;
  readonly disabled: boolean;
  readonly canvas: PixelArtCanvas;
}

function isThemeMode(
  value: string
): value is ThemeMode {
  return value === "light" || value === "dark" || value === "auto";
}

function isBrushMode(
  mode: Mode
): boolean {
  return mode === "paint" || mode === "erase";
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
        return (value !== null && UvAccessPolicy.isAccess(value)) ? value : "edit";
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

  @property({ type: Boolean, attribute: "textures-closable" })
  declare texturesClosable: boolean;

  @property({
    type: String,
    reflect: true,
    attribute: "texture-tabs",
    converter: {
      fromAttribute(value) {
        return (value !== null && isTextureTabsMode(value)) ? value : "auto";
      }
    }
  })
  declare textureTabs: TextureTabsMode;

  @property({ type: Boolean, attribute: "textures-addable" })
  declare texturesAddable: boolean;

  @property({ type: Boolean, attribute: "textures-editable" })
  declare texturesEditable: boolean;

  @property({ type: String, attribute: "texture-add-label" })
  declare textureAddLabel: string;

  @property({ type: String, attribute: "texture-tabs-variant" })
  declare textureTabsVariant: TabsVariant;

  readonly #textures = new TextureSet(this, {
    container: () => this.#element(".canvas-host"),
    onActivate: () => {
      this.#selectToolbar.clearStatus();
      this.#importer.status.clear();
    },
    onModeChange: (mode) => this.#selectToolbar.onModeChange(mode === "select"),
    onClipboardResult: (result) => this.#selectToolbar.onClipboardResult(result)
  });
  readonly #importer = new TextureImporter(this, {
    textures: this.#textures,
    policy: () => this.textureImportPolicy
  });
  readonly #activeCanvas = (): PixelArtCanvas | null => this.canvasManager;
  readonly #uvToolbar = new UvToolbarController(this, this.#activeCanvas);
  readonly #selectToolbar = new SelectToolbarController(this, this.#activeCanvas);
  readonly #textureDrop = new TextureDropController(this, {
    canvas: this.#activeCanvas,
    importer: this.#importer
  });
  readonly #colors = new ColorController(this, this.#activeCanvas);

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
    this.texturesClosable = true;
    this.textureTabs = "auto";
    this.texturesAddable = false;
    this.texturesEditable = false;
    this.textureAddLabel = "Add texture";
    this.textureTabsVariant = "default";
  }

  get canvasManager(): PixelArtCanvas | null {
    return this.#textures.active?.canvas ?? null;
  }

  get textures(): PixelDrawTexture[] {
    return [...this.#textures.values()].map((entry) => {
      return {
        id: entry.id,
        name: entry.name,
        tooltip: entry.tooltip,
        badge: entry.badge,
        disabled: entry.disabled,
        canvas: entry.canvas
      };
    });
  }

  get resolvedTheme(): ResolvedThemeMode {
    if (this.theme !== "auto") {
      return this.theme;
    }

    return ambientThemeMode(this) ??
      (this.#prefersDarkQuery?.matches ? "dark" : "light");
  }

  get activeTextureId(): string | null {
    return this.#textures.active?.id ?? null;
  }

  set activeTextureId(
    id: string
  ) {
    this.#activateTexture(id, "api");
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener("colorpicked", this.#onColorPicked);
    this.#prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.#prefersDarkQuery.addEventListener("change", this.#onPrefersColorSchemeChange);
    this.#syncAmbientTheme();
    this.#observeCanvasHost();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("colorpicked", this.#onColorPicked);
    this.#prefersDarkQuery?.removeEventListener("change", this.#onPrefersColorSchemeChange);
    this.#prefersDarkQuery = null;
    this.#canvasHostObserver?.disconnect();
    this.#canvasHostObserver = null;
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.#destroyTextures();
      }
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
      this.#onThemeChange();
    }
  }

  async initialize(
    options: PixelDrawInitializeOptions = {}
  ): Promise<PixelArtCanvas> {
    this.#destroyTextures();
    await this.configure(options);
    const canvas = this.addTexture({
      ...options,
      id: options.id ?? kDefaultTextureId,
      name: options.name ?? kDefaultTextureName
    });
    await this.updateComplete;

    return canvas;
  }

  async configure(
    options: PixelArtCanvasOptions = {}
  ): Promise<void> {
    await this.updateComplete;
    this.#baseOptions = textureCanvasOptions({}, options);
  }

  addTexture(
    options: PixelDrawTextureOptions,
    addOptions: AddTextureOptions = {}
  ): PixelArtCanvas {
    if (this.#baseOptions === null) {
      throw new Error("PixelDrawPanel: call configure() before addTexture()");
    }

    const first = this.canvasManager === null;
    const fresh = first && !this.#textures.carriesSettings;
    const previous = this.activeTextureId;
    const canvas = this.#createTexture(
      {
        ...textureCanvasOptions(this.#baseOptions, options),
        id: options.id,
        name: options.name,
        tooltip: options.tooltip,
        badge: options.badge,
        disabled: options.disabled
      },
      addOptions.activate ?? true
    );
    if (fresh && this.canvasManager !== null) {
      this.#colors.adopt();
    }
    if (first && this.canvasManager !== null) {
      this.#applyUvAccess();
      void this.updateComplete.then(() => this.setAttribute("data-ready", ""));
    }
    if (previous !== null && this.activeTextureId !== previous) {
      this.#emitTextureChange(options.id, "api");
    }

    return canvas;
  }

  removeTexture(
    id: string
  ): void {
    const next = this.#textures.remove(id);
    if (next !== null) {
      this.#emitTextureChange(next.id, "api");
    }
  }

  renameTexture(
    id: string,
    name: string
  ): void {
    this.updateTexture(id, { name });
  }

  updateTexture(
    id: string,
    changes: TextureUpdate
  ): void {
    this.#textures.update(id, changes);
  }

  onResize(): void {
    this.canvasManager?.onResize();
  }

  #element(
    selector: string
  ): HTMLElement {
    return assertElement(
      this.renderRoot.querySelector<HTMLElement>(selector),
      `PixelDrawPanel: ${selector} element not found`
    );
  }

  #observeCanvasHost(): void {
    if (
      this.#canvasHostObserver !== null ||
      typeof ResizeObserver === "undefined"
    ) {
      return;
    }

    const canvasHostEl = this.renderRoot.querySelector(".canvas-host");
    if (canvasHostEl === null) {
      return;
    }

    this.#canvasHostObserver = new ResizeObserver(() => this.onResize());
    this.#canvasHostObserver.observe(canvasHostEl);
  }

  #createTexture(
    options: PixelDrawTextureOptions,
    activate: boolean
  ): PixelArtCanvas {
    const { canvas } = this.#textures.create({
      ...options,
      defaultMode: this.#uvPolicy.constrain(options.defaultMode ?? "paint"),
      backgroundColor: this.#canvasBackground() || options.backgroundColor
    }, activate);
    this.#syncCanvasBackground();

    return canvas;
  }

  #destroyTextures(): void {
    this.#textures.clear();
    this.#baseOptions = null;
  }

  readonly #onColorPicked = (
    event: CustomEvent<ColorPickedDetail>
  ): void => {
    this.#colors.onColorPicked(event.detail);
  };

  readonly #onPrefersColorSchemeChange = (): void => {
    if (this.theme === "auto") {
      this.#onThemeChange();
    }
  };

  #onThemeChange(): void {
    this.#syncCanvasBackground();
    this.dispatchEvent(new CustomEvent<ResolvedThemeMode>("theme-change", {
      bubbles: true,
      composed: true,
      detail: this.resolvedTheme
    }));
  }

  #dispatchCanvasHover(
    hovering: boolean
  ): void {
    this.dispatchEvent(new CustomEvent<CanvasHoverChangeDetail>("canvas-hover-change", {
      bubbles: true,
      composed: true,
      detail: { hovering }
    }));
  }

  #onDockToggle(): void {
    this.colorDocked = !this.colorDocked;
    this.dispatchEvent(new CustomEvent<boolean>("color-docked-change", {
      bubbles: true,
      composed: true,
      detail: this.colorDocked
    }));
  }

  #activateTexture(
    id: string,
    source: TextureChangeSource
  ): void {
    const entry = this.#textures.get(id);
    if (entry !== this.#textures.active) {
      this.#textures.activate(entry);
      this.#emitTextureChange(entry.id, source);
    }
  }

  #emitTextureChange(
    id: string,
    source: TextureChangeSource
  ): void {
    this.dispatchEvent(new CustomEvent<TextureChangeDetail>("texture-change", {
      bubbles: true,
      composed: true,
      detail: {
        id,
        source
      }
    }));
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

  #onTextureTabAction(
    event: CustomEvent<JollyTabChangeDetail>
  ): void {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent<TextureEditRequestDetail>("texture-edit-request", {
      bubbles: true,
      composed: true,
      detail: { id: event.detail.value }
    }));
  }

  #onTextureCreateClick(): void {
    this.dispatchEvent(new CustomEvent("texture-create-request", {
      bubbles: true,
      composed: true
    }));
  }

  #editCanvas(
    edit: (canvas: PixelArtCanvas) => void
  ): void {
    const canvas = this.canvasManager;
    if (canvas) {
      edit(canvas);
      this.requestUpdate();
    }
  }

  get #uvPolicy(): UvAccessPolicy {
    return UvAccessPolicy.of(this.uvAccess);
  }

  #applyUvAccess(): void {
    const canvas = this.canvasManager;
    if (!canvas) {
      return;
    }

    canvas.mode = this.#uvPolicy.constrain(canvas.mode);
    if (!this.#uvPolicy.fillClip) {
      canvas.tools.fill.uvClip = false;
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
      canvas.backgroundColor = canvasBg;
    }
  }

  #canvasBackground(): string {
    return resolveThemeColor(this, "--color-canvas-bg");
  }

  #renderBusy() {
    const busy = this.#importer.busy.state;
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
    if (this.textureTabs === "auto" && this.#textures.size < 2) {
      return nothing;
    }

    return html`
      <jolly-tabs
        class="texture-tabs"
        part="texture-tabs"
        .variant=${this.textureTabsVariant}
        .value=${this.activeTextureId ?? ""}
        @jolly-tab-change=${(event: CustomEvent<JollyTabChangeDetail>) => {
          event.stopPropagation();
          this.#activateTexture(event.detail.value, "user");
        }}
        @jolly-tab-close=${(event: CustomEvent<JollyTabChangeDetail>) => {
          this.#onTextureTabClose(event);
        }}
        @jolly-tab-action=${(event: CustomEvent<JollyTabChangeDetail>) => {
          this.#onTextureTabAction(event);
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
              .badge=${entry.badge}
              .action=${this.texturesEditable ? "edit" : ""}
              .actionLabel=${"Edit"}
              ?disabled=${entry.disabled}
              ?closable=${this.texturesClosable}
            ></jolly-tab>
          `
        )}
        ${this.texturesAddable ?
          html`
            <jolly-button
              slot="list-end"
              class="texture-add"
              part="texture-add"
              icon="add"
              icon-only
              label=${this.textureAddLabel}
              title=${this.textureAddLabel}
              @click=${() => this.#onTextureCreateClick()}
            ></jolly-button>
          ` :
          nothing}
      </jolly-tabs>
    `;
  }

  override render() {
    const canvas = this.canvasManager;
    const mode = canvas?.mode ?? "paint";
    const policy = this.#uvPolicy;

    return html`
      <div class="rail" part="rail">
        <mode-rail
          .mode=${mode}
          .options=${canvas ? readToolOptions(canvas) : DEFAULT_TOOL_OPTIONS}
          .uvAccess=${this.uvAccess}
          @mode-change=${(event: CustomEvent<Mode>) => {
            this.#editCanvas((target) => {
              target.mode = event.detail;
            });
          }}
          @tool-option-change=${(event: CustomEvent<ToolOption>) => {
            this.#editCanvas((target) => applyToolOption(target, event.detail));
          }}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#colors.foreground}
          .background=${this.#colors.background}
          .docked=${this.colorDocked}
          @foreground-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.changeForeground(event.detail);
          }}
          @background-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.changeBackground(event.detail);
          }}
          @swap=${() => this.#colors.swap()}
          @dock-toggle=${() => this.#onDockToggle()}
        ></color-picker-rail>
      </div>

      <div class="workspace" part="workspace">
        ${this.#renderTextureTabs()}
        <div
          class="stage"
          part="stage"
          @dragenter=${this.#textureDrop.onDragOver}
          @dragover=${this.#textureDrop.onDragOver}
          @dragleave=${this.#textureDrop.onDragLeave}
          @drop=${this.#textureDrop.onDrop}
        >
          <div
            class="canvas-host"
            part="canvas-host"
            @mouseenter=${() => this.#dispatchCanvasHover(true)}
            @mouseleave=${() => this.#dispatchCanvasHover(false)}
          ></div>
          ${this.#renderBusy()}
          ${this.#textureDrop.render()}
          <div
            class="drop-status"
            part="drop-status"
            aria-live="polite"
            aria-atomic="true"
          >${this.#importer.status.value}</div>
          ${canvas && isBrushMode(mode) ?
            renderBrushSizeOverlay(canvas, () => this.requestUpdate()) :
            nothing}
          ${this.#selectToolbar.render(mode === "select")}
          ${this.#uvToolbar.render(
            mode === "uv" && policy.uvMode,
            this.allowUvCreateDelete
          )}
          ${renderHistoryFileToolbar({
            canvas: this.#activeCanvas,
            importer: this.#importer,
            trailing: policy.visibilityInBottomBar ?
              this.#uvToolbar.renderVisibilityToggles() :
              nothing
          })}
        </div>
        <color-dock
          class="color-dock"
          part="color-dock"
          ?open=${this.colorDocked}
          ?inert=${!this.colorDocked}
          .color=${this.#colors.foreground.hex}
          .opacity=${this.#colors.foreground.opacity}
          @color-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.changeActive(event.detail);
          }}
        ></color-dock>
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
    "canvas-hover-change": CustomEvent<CanvasHoverChangeDetail>;
    "color-docked-change": CustomEvent<boolean>;
    "texture-add-request": CustomEvent<TextureAddRequestDetail>;
    "texture-change": CustomEvent<TextureChangeDetail>;
    "texture-close-request": CustomEvent<TextureCloseRequestDetail>;
    "texture-create-request": CustomEvent<undefined>;
    "texture-edit-request": CustomEvent<TextureEditRequestDetail>;
    "theme-change": CustomEvent<ResolvedThemeMode>;
  }
}
