// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { Emitter } from "@openally/emitt";
import {
  PixelArtCanvas,
  type ClipboardOperationResult,
  type Mode,
  type PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  TextureEntry,
  type PixelDrawTextureOptions,
  type TextureUpdate
} from "./TextureEntry.ts";
import {
  CanvasDefaults,
  type CanvasDefaultsInit
} from "./CanvasDefaults.ts";
import { ToolSettings } from "../tools/ToolSettings.ts";
import { ViewSettings } from "../panel/ViewSettings.ts";
import { PIXEL_ART_CAPABILITIES } from "../access/PixelArtAccess.ts";
import {
  TextureAccess,
  type UvAccess
} from "../access/TextureAccess.ts";

// CONSTANTS
const kUvRefreshEvents = [
  "selection-changed",
  "region-state-changed",
  "region-created",
  "region-deleted",
  "visibility-changed",
  "label-visibility-changed",
  "size-label-visibility-changed"
] as const;

export type TextureChangeSource = "user" | "api";

export interface TextureChangeDetail {
  id: string;
  source: TextureChangeSource;
}

export type TextureSetEvents = {
  "active-change": () => void;
  "mode-change": (mode: Mode) => void;
  "clipboard-result": (result: ClipboardOperationResult) => void;
};

export type TextureEvents = Pick<Emitter<TextureSetEvents>, "subscribe">;

export type TextureSetHost = ReactiveControllerHost & EventTarget;

interface CarriedSettings {
  tools: ToolSettings;
  view: ViewSettings;
}

export class TextureSet extends Emitter<TextureSetEvents> {
  readonly #host: TextureSetHost;
  readonly #container: () => HTMLElement;
  readonly #entries = new Map<string, TextureEntry>();
  #active: TextureEntry | null = null;
  #settings: CarriedSettings | null = null;
  #defaults = new CanvasDefaults();
  #uvAccess: UvAccess = "edit";

  constructor(
    host: TextureSetHost,
    container: () => HTMLElement
  ) {
    super();
    this.#host = host;
    this.#container = container;
  }

  get active(): TextureEntry | null {
    return this.#active;
  }

  get size(): number {
    return this.#entries.size;
  }

  get carriesSettings(): boolean {
    return this.#settings !== null;
  }

  get activeAccess(): TextureAccess {
    return new TextureAccess(
      this.#uvAccess,
      this.#active?.access ?? PIXEL_ART_CAPABILITIES.full
    );
  }

  set uvAccess(
    value: UvAccess
  ) {
    this.#uvAccess = value;
    for (const entry of this.#entries.values()) {
      this.#access(entry).applyTo(entry.canvas);
    }
  }

  configureCanvases(
    changes: Partial<CanvasDefaultsInit>
  ): void {
    this.#defaults = this.#defaults.with(changes);
    for (const { canvas } of this.#entries.values()) {
      this.#defaults.applyTo(canvas);
    }
  }

  [Symbol.iterator](): IterableIterator<TextureEntry> {
    return this.#entries.values();
  }

  get(
    id: string
  ): TextureEntry {
    const entry = this.#entries.get(id);
    if (entry === undefined) {
      throw new Error(`PixelDrawPanel: unknown texture "${id}"`);
    }

    return entry;
  }

  has(
    canvas: PixelArtCanvas
  ): boolean {
    for (const entry of this.#entries.values()) {
      if (entry.canvas === canvas) {
        return true;
      }
    }

    return false;
  }

  create(
    options: PixelDrawTextureOptions,
    activate = true
  ): TextureEntry {
    const {
      id,
      name,
      tooltip = "",
      disabled = false,
      access = PIXEL_ART_CAPABILITIES.full,
      ...canvasOptions
    } = options;
    if (this.#entries.has(id)) {
      throw new Error(`PixelDrawPanel: texture "${id}" already exists`);
    }

    const host = document.createElement("div");
    host.className = "texture-host";
    host.dataset.textureId = id;
    this.#container().append(host);
    this.#show(host);

    const textureAccess = new TextureAccess(this.#uvAccess, access);
    let canvas: PixelArtCanvas;
    try {
      canvas = this.#createCanvas(host, {
        ...canvasOptions,
        defaultMode: textureAccess.constrain(
          canvasOptions.defaultMode ?? "paint"
        )
      });
    }
    catch (error) {
      host.remove();
      if (this.#active !== null) {
        this.#show(this.#active.host);
      }

      throw error;
    }

    const entry = new TextureEntry({
      id,
      name,
      tooltip,
      disabled,
      access,
      host,
      canvas
    });
    textureAccess.applyTo(canvas);
    this.#entries.set(id, entry);
    if (!disabled && (activate || this.#active === null)) {
      this.#activate(entry, "api");
    }
    else {
      this.#show(this.#active?.host ?? null);
      this.#host.requestUpdate();
    }

    return entry;
  }

  update(
    id: string,
    changes: TextureUpdate
  ): void {
    const entry = this.get(id);
    entry.update(changes);
    if (changes.access !== undefined) {
      this.#access(entry).applyTo(entry.canvas);
    }
    this.#host.requestUpdate();
  }

  activate(
    id: string,
    source: TextureChangeSource
  ): void {
    this.#activate(this.get(id), source);
  }

  remove(
    id: string
  ): void {
    const entry = this.get(id);
    if (this.#entries.size === 1 && !entry.disabled) {
      throw new Error(`PixelDrawPanel: cannot remove "${id}", the last texture`);
    }

    const next = entry === this.#active ? this.#successor(entry) : null;
    this.#entries.delete(id);

    if (next !== null) {
      this.#activate(next, "api");
    }
    else if (entry === this.#active) {
      this.#release();
    }

    entry.destroy();
    this.#host.requestUpdate();
  }

  clear(): void {
    this.#release();
    for (const entry of this.#entries.values()) {
      entry.destroy();
    }
    this.#entries.clear();
  }

  #activate(
    entry: TextureEntry,
    source: TextureChangeSource
  ): void {
    if (entry === this.#active || entry.disabled) {
      return;
    }

    const switched = this.#active !== null;
    this.#deactivate();
    this.#active = entry;
    this.#show(entry.host);
    if (this.#settings !== null) {
      this.#settings.tools.applyTo(entry.canvas);
      this.#settings.view.applyTo(entry.canvas);
      this.#access(entry).applyTo(entry.canvas);
    }
    this.#subscribe(entry.canvas);
    entry.canvas.onResize();
    this.emit("active-change");
    if (switched) {
      this.#host.dispatchEvent(new CustomEvent<TextureChangeDetail>("texture-change", {
        bubbles: true,
        composed: true,
        detail: {
          id: entry.id,
          source
        }
      }));
    }
    this.#host.requestUpdate();
  }

  #release(): void {
    if (this.#active !== null) {
      this.#deactivate();
      this.emit("active-change");
    }
  }

  #successor(
    entry: TextureEntry
  ): TextureEntry | null {
    const candidates = [...this.#entries.values()]
      .filter((candidate) => candidate === entry || !candidate.disabled);
    const index = candidates.indexOf(entry);

    return candidates[index + 1] ?? candidates[index - 1] ?? null;
  }

  #createCanvas(
    host: HTMLDivElement,
    options: PixelArtCanvasOptions
  ): PixelArtCanvas {
    const isActive = () => this.#active?.host === host;

    const canvas = new PixelArtCanvas(host, {
      ...options,
      onHistoryChange: (state) => {
        if (isActive()) {
          this.#host.requestUpdate();
        }
        options.onHistoryChange?.(state);
      },
      onModeChange: (mode, previousMode) => {
        if (isActive()) {
          this.emit("mode-change", mode);
          this.#host.requestUpdate();
        }
        options.onModeChange?.(mode, previousMode);
      },
      onClipboardResult: (result) => {
        if (isActive()) {
          this.emit("clipboard-result", result);
        }
        options.onClipboardResult?.(result);
      }
    });
    this.#defaults.applyTo(canvas);

    return canvas;
  }

  #access(
    entry: TextureEntry
  ): TextureAccess {
    return new TextureAccess(this.#uvAccess, entry.access);
  }

  #deactivate(): void {
    const previous = this.#active;
    if (previous === null) {
      return;
    }

    this.#settings = {
      tools: ToolSettings.capture(previous.canvas),
      view: ViewSettings.capture(previous.canvas)
    };
    this.#unsubscribe(previous.canvas);
    this.#active = null;
  }

  #show(
    visible: HTMLDivElement | null
  ): void {
    for (const { host } of this.#entries.values()) {
      host.hidden = host !== visible;
    }

    if (visible !== null) {
      visible.hidden = false;
    }
  }

  #subscribe(
    canvas: PixelArtCanvas
  ): void {
    for (const type of kUvRefreshEvents) {
      canvas.uv.on(type, this.#refresh);
    }
    canvas.selectionEvents.on(
      "selection-state-changed",
      this.#refresh
    );
    canvas.document.on(
      "normal-map-changed",
      this.#refresh
    );
    canvas.canvas().addEventListener(
      "wheel",
      this.#onWheel
    );
  }

  #unsubscribe(
    canvas: PixelArtCanvas
  ): void {
    for (const type of kUvRefreshEvents) {
      canvas.uv.off(type, this.#refresh);
    }
    canvas.selectionEvents.off(
      "selection-state-changed",
      this.#refresh
    );
    canvas.document.off(
      "normal-map-changed",
      this.#refresh
    );
    canvas.canvas().removeEventListener(
      "wheel",
      this.#onWheel
    );
  }

  readonly #refresh = (): void => {
    this.#host.requestUpdate();
  };

  readonly #onWheel = (
    event: WheelEvent
  ): void => {
    if (event.ctrlKey) {
      this.#host.requestUpdate();
    }
  };
}
