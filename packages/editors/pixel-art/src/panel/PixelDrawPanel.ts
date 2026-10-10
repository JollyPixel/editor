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
import type {
  PixelArtCanvas,
  PixelArtCanvasOptions,
  Mode
} from "@jolly-pixel/pixel-draw.renderer";
import {
  ambientThemeMode,
  resolveThemeColor,
  themeStyles,
  type ResolvedThemeMode,
  type TabsVariant
} from "@jolly-pixel/ui";
import { StandalonePixelHistory } from "@jolly-pixel/asset.pixel-art/client";

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
import { NormalMapController } from "../normal/NormalMapController.ts";
import { DockSlot } from "./DockSlot.ts";
import {
  ColorController,
  type ColorPickedDetail
} from "../color/ColorController.ts";
import {
  UvAccessPolicy,
  type UvAccess
} from "../uv/UvAccessPolicy.ts";
import { TransientStatus } from "../shared/TransientStatus.ts";
import {
  applyToolOption,
  DEFAULT_TOOL_OPTIONS,
  readToolOptions,
  type ToolOption
} from "../tools/toolOptions.ts";
import { TextureSet } from "../textures/TextureSet.ts";
import type {
  PixelDrawTextureOptions,
  TextureUpdate
} from "../textures/TextureEntry.ts";
import {
  TextureImporter,
  type TextureAddRequestDetail,
  type TextureImportPolicy
} from "../textures/import/TextureImporter.ts";
import {
  TextureTabStrip,
  type TextureChangeDetail,
  type TextureCloseRequestDetail,
  type TextureEditRequestDetail,
  type TextureTabsMode
} from "../textures/TextureTabStrip.ts";
import "../textures/dialogs/ClearTextureDialog.ts";
import "../textures/dialogs/ImportTextureDialog.ts";
import {
  CanvasKeyboardController,
  type CanvasHoverChangeDetail
} from "./CanvasKeyboardController.ts";
import type { PixelArtKeyBindings } from "../keybindings/PixelArtKeyBindings.ts";
import "../color/ColorPickerRail.ts";
import "../color/ColorDock.ts";
import "../color/ColorPickerPopover.ts";
import "../normal/NormalMapDock.ts";

// CONSTANTS
const kNoModes: ReadonlySet<Mode> = new Set();
const kDefaultTextureId = "default";
const kDefaultTextureName = "Texture";

export type ThemeMode = "light" | "dark" | "auto";

export interface AddTextureOptions {
  activate?: boolean;
}

export interface PixelDrawInitializeOptions extends PixelArtCanvasOptions {
  id?: string;
  name?: string;
  tooltip?: string;
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

  @property({ type: Boolean, attribute: "uv-resize" })
  declare uvResize: boolean;

  @property({ type: Number, attribute: "uv-overflow" })
  declare uvOverflow: number;

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

  @property({ type: Boolean, reflect: true, attribute: "normal-map" })
  declare normalMap: boolean;

  @property({
    type: String,
    reflect: true,
    attribute: "texture-import-policy",
    converter: {
      fromAttribute(value) {
        return TextureImporter.parsePolicy(value) ?? "replace";
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
        return value === "always" ? "always" : "auto";
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

  readonly #status = new TransientStatus(this);
  readonly #textures = new TextureSet(this, {
    container: () => this.#element(".canvas-host"),
    onActivate: () => {
      this.#selectToolbar.clearStatus();
      this.#status.clear();
      this.#normalMaps.onActivate();
    },
    onModeChange: (mode) => this.#selectToolbar.onModeChange(mode === "select"),
    onClipboardResult: (result) => this.#selectToolbar.onClipboardResult(result)
  });
  readonly #tabs = new TextureTabStrip(this, this.#textures);
  readonly #importer = new TextureImporter(this, {
    textures: this.#textures,
    status: this.#status,
    policy: () => this.textureImportPolicy,
    dialog: () => this.#dialog("import-texture-dialog")
  });
  readonly #activeCanvas = (): PixelArtCanvas | null => this.canvasManager;
  readonly #uvToolbar = new UvToolbarController(this, this.#activeCanvas);
  readonly #selectToolbar = new SelectToolbarController(this, this.#activeCanvas);
  readonly #textureDrop = new TextureDropController(this, {
    canvas: this.#activeCanvas,
    importer: this.#importer
  });
  readonly #colors = new ColorController(this, this.#activeCanvas);
  readonly #docks = new DockSlot(this, () => this.#syncColorDocked());
  readonly #normalMaps = new NormalMapController(this, {
    canvas: this.#activeCanvas,
    canvases: () => [...this.#textures].map((entry) => entry.canvas),
    docks: this.#docks,
    locked: () => !this.#textures.activeAccess.normalMap
  });
  readonly #keyboard = new CanvasKeyboardController(
    this,
    () => this.canvasManager?.shortcuts ?? null
  );

  #baseOptions: PixelArtCanvasOptions | null = null;
  #prefersDarkQuery: MediaQueryList | null = null;
  #canvasHostObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.allowUvCreateDelete = false;
    this.uvResize = false;
    this.uvOverflow = 0;
    this.uvAccess = "edit";
    this.theme = "auto";
    this.colorDocked = false;
    this.normalMap = false;
    this.textureImportPolicy = "replace";
    this.texturesClosable = true;
    this.textureTabs = "auto";
    this.texturesAddable = false;
    this.texturesEditable = false;
    this.textureAddLabel = "Add texture";
    this.textureTabsVariant = "default";
  }

  get keyBindings(): PixelArtKeyBindings {
    return this.#keyboard.keyBindings;
  }

  set keyBindings(
    keyBindings: PixelArtKeyBindings
  ) {
    this.#keyboard.keyBindings = keyBindings;
  }

  get canvasManager(): PixelArtCanvas | null {
    return this.#textures.active?.canvas ?? null;
  }

  get textures(): PixelDrawTexture[] {
    return [...this.#textures].map((entry) => {
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
    this.#tabs.activate(id, "api");
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
      this.#docks.toggle("color", this.colorDocked);
    }
    if (changedProperties.has("normalMap") && !this.normalMap) {
      this.#normalMaps.disable();
    }
    if (changedProperties.has("uvAccess")) {
      this.#textures.uvAccess = this.uvAccess;
    }
    if (changedProperties.has("uvResize")) {
      this.#textures.uvResizable = this.uvResize;
    }
    if (changedProperties.has("uvOverflow")) {
      this.#textures.uvOverflow = this.uvOverflow;
    }
    this.#colors.paletteLocked = !this.#textures.activeAccess.palette;
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
    const {
      id = kDefaultTextureId,
      name = kDefaultTextureName,
      tooltip,
      ...canvasOptions
    } = options;
    this.#destroyTextures();
    await this.configure(canvasOptions);
    const canvas = this.addTexture({
      ...canvasOptions,
      id,
      name,
      tooltip
    });
    await this.updateComplete;

    return canvas;
  }

  async configure(
    options: PixelArtCanvasOptions = {}
  ): Promise<void> {
    await this.updateComplete;
    this.#baseOptions = {
      history: new StandalonePixelHistory(),
      ...options
    };
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
        ...this.#baseOptions,
        ...options
      },
      addOptions.activate ?? true
    );
    if (fresh && this.canvasManager !== null) {
      this.#colors.adopt();
    }
    if (first && this.canvasManager !== null) {
      void this.updateComplete.then(() => this.setAttribute("data-ready", ""));
    }
    if (previous !== null && this.activeTextureId !== previous) {
      this.#tabs.emitChange(options.id, "api");
    }

    return canvas;
  }

  removeTexture(
    id: string
  ): void {
    const next = this.#textures.remove(id);
    if (next !== null) {
      this.#tabs.emitChange(next.id, "api");
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

  announce(
    message: string
  ): void {
    this.#status.set(message);
  }

  #element(
    selector: string
  ): HTMLElement {
    const element = this.renderRoot.querySelector<HTMLElement>(selector);
    if (element === null) {
      throw new Error(`PixelDrawPanel: ${selector} element not found`);
    }

    return element;
  }

  #dialog<TName extends "clear-texture-dialog" | "import-texture-dialog">(
    name: TName
  ): HTMLElementTagNameMap[TName] {
    const dialog = this.renderRoot.querySelector(name);
    if (dialog === null) {
      throw new Error(`PixelDrawPanel: ${name} element not found`);
    }

    return dialog;
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

  #syncColorDocked(): void {
    const docked = this.#docks.isOpen("color");
    this.#colors.docked = docked;
    if (docked === this.colorDocked) {
      return;
    }

    this.colorDocked = docked;
    this.dispatchEvent(new CustomEvent<boolean>("color-docked-change", {
      bubbles: true,
      composed: true,
      detail: docked
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

    for (const { canvas } of this.#textures) {
      canvas.backgroundColor = canvasBg;
    }
  }

  #canvasBackground(): string {
    return resolveThemeColor(this, "--color-canvas-bg");
  }

  override render() {
    const canvas = this.canvasManager;
    const mode = canvas?.mode ?? "paint";
    const access = this.#textures.activeAccess;
    const policy = this.#textures.activeUvPolicy;
    const normalMaps = this.normalMap ? this.#normalMaps : null;

    return html`
      <div class="rail" part="rail">
        <mode-rail
          .mode=${mode}
          .options=${canvas ? readToolOptions(canvas) : DEFAULT_TOOL_OPTIONS}
          .uvAccess=${policy.access}
          .unavailableModes=${canvas?.unavailableModes ?? kNoModes}
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
          @dock-toggle=${() => this.#docks.toggle("color")}
        ></color-picker-rail>
      </div>

      <div class="workspace" part="workspace">
        ${this.#tabs.render()}
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
            @mouseenter=${() => this.#keyboard.hover(true)}
            @mouseleave=${() => this.#keyboard.hover(false)}
          ></div>
          ${this.#importer.busy.render()}
          ${this.#textureDrop.render()}
          <div
            class="drop-status"
            part="drop-status"
            aria-live="polite"
            aria-atomic="true"
          >${this.#status.value}</div>
          ${canvas && isBrushMode(mode) ?
            renderBrushSizeOverlay(canvas, () => this.requestUpdate()) :
            nothing}
          ${this.#selectToolbar.render(mode === "select")}
          ${this.#uvToolbar.render(
            mode === "uv" && policy.uvMode,
            this.allowUvCreateDelete && access.uvStructure,
            normalMaps?.renderOverrideButton() ?? nothing
          )}
          ${renderHistoryFileToolbar({
            canvas: this.#activeCanvas,
            importer: this.#importer,
            clearDialog: () => this.#dialog("clear-texture-dialog"),
            viewOnly: access.viewOnly,
            exportMenu: (exportAlbedo) => (
              normalMaps?.renderExportButton(exportAlbedo) ?? nothing
            ),
            trailing: [
              normalMaps?.renderViewSwitch() ?? nothing,
              policy.visibilityInBottomBar ?
                this.#uvToolbar.renderVisibilityToggles() :
                nothing
            ]
          })}
        </div>
        <div class="dock-slot" part="dock-slot">
          ${this.#colors.renderDock()}${normalMaps?.renderDock() ?? nothing}
        </div>
      </div>
      ${this.#colors.renderPopover()}
      <clear-texture-dialog></clear-texture-dialog>
      <import-texture-dialog></import-texture-dialog>
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
