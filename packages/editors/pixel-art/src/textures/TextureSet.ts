// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  PixelArtCanvas,
  type ClipboardOperationResult,
  type Mode,
  type PixelArtCanvasOptions
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  nextActiveTextureId,
  type PixelDrawTextureOptions,
  type TextureUpdate
} from "./textures.ts";
import { ToolSettings } from "../tools/ToolSettings.ts";

// CONSTANTS
const kUvRefreshEvents = [
  "selection-changed",
  "region-state-changed",
  "region-created",
  "region-deleted",
  "visibility-changed",
  "label-visibility-changed"
] as const;

export interface TextureEntry {
  readonly id: string;
  name: string;
  tooltip: string;
  badge: string;
  readonly disabled: boolean;
  readonly host: HTMLDivElement;
  readonly canvas: PixelArtCanvas;
}

export interface TextureSetOptions {
  container: () => HTMLElement;
  onActivate: (entry: TextureEntry) => void;
  onModeChange: (mode: Mode) => void;
  onClipboardResult: (result: ClipboardOperationResult) => void;
}

export class TextureSet {
  readonly #host: ReactiveControllerHost;
  readonly #options: TextureSetOptions;
  readonly #entries = new Map<string, TextureEntry>();
  #active: TextureEntry | null = null;
  #settings: ToolSettings | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: TextureSetOptions
  ) {
    this.#host = host;
    this.#options = options;
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

  values(): IterableIterator<TextureEntry> {
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
      badge = "",
      disabled = false,
      ...canvasOptions
    } = options;
    if (this.#entries.has(id)) {
      throw new Error(`PixelDrawPanel: texture "${id}" already exists`);
    }

    const host = document.createElement("div");
    host.className = "texture-host";
    host.dataset.textureId = id;
    this.#options.container().append(host);
    this.#show(host);

    let canvas: PixelArtCanvas;
    try {
      canvas = this.#createCanvas(host, canvasOptions);
    }
    catch (error) {
      host.remove();
      if (this.#active !== null) {
        this.#show(this.#active.host);
      }

      throw error;
    }

    const entry: TextureEntry = {
      id,
      name,
      tooltip,
      badge,
      disabled,
      host,
      canvas
    };
    this.#entries.set(id, entry);
    if (!disabled && (activate || this.#active === null)) {
      this.activate(entry);
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
    entry.name = changes.name ?? entry.name;
    entry.tooltip = changes.tooltip ?? entry.tooltip;
    entry.badge = changes.badge ?? entry.badge;
    this.#host.requestUpdate();
  }

  activate(
    entry: TextureEntry
  ): void {
    if (entry === this.#active || entry.disabled) {
      return;
    }

    this.#deactivate();
    this.#active = entry;
    this.#show(entry.host);
    if (this.#settings !== null) {
      this.#settings.applyTo(entry.canvas);
    }
    this.#subscribe(entry.canvas);
    entry.canvas.onResize();
    this.#options.onActivate(entry);
    this.#host.requestUpdate();
  }

  remove(
    id: string
  ): TextureEntry | null {
    const entry = this.get(id);
    if (this.#entries.size === 1 && !entry.disabled) {
      throw new Error(`PixelDrawPanel: cannot remove "${id}", the last texture`);
    }

    const candidates = [...this.#entries.values()]
      .filter((candidate) => candidate === entry || !candidate.disabled)
      .map((candidate) => candidate.id);
    const nextId = nextActiveTextureId(
      candidates,
      id,
      this.#active?.id ?? null
    );
    this.#entries.delete(id);

    const next = entry === this.#active && nextId !== null ?
      this.get(nextId) :
      null;
    if (next !== null) {
      this.activate(next);
    }
    else if (entry === this.#active) {
      this.#deactivate();
    }

    this.#destroy(entry);
    this.#host.requestUpdate();

    return next;
  }

  clear(): void {
    this.#deactivate();
    for (const entry of this.#entries.values()) {
      this.#destroy(entry);
    }
    this.#entries.clear();
  }

  #createCanvas(
    host: HTMLDivElement,
    options: PixelArtCanvasOptions
  ): PixelArtCanvas {
    const isActive = () => this.#active?.host === host;

    return new PixelArtCanvas(host, {
      ...options,
      onHistoryChange: (state) => {
        if (isActive()) {
          this.#host.requestUpdate();
        }
        options.onHistoryChange?.(state);
      },
      onModeChange: (mode, previousMode) => {
        if (isActive()) {
          this.#options.onModeChange(mode);
          this.#host.requestUpdate();
        }
        options.onModeChange?.(mode, previousMode);
      },
      onClipboardResult: (result) => {
        if (isActive()) {
          this.#options.onClipboardResult(result);
        }
        options.onClipboardResult?.(result);
      }
    });
  }

  #deactivate(): void {
    const previous = this.#active;
    if (previous === null) {
      return;
    }

    this.#settings = ToolSettings.capture(previous.canvas);
    this.#unsubscribe(previous.canvas);
    this.#active = null;
  }

  #destroy(
    entry: TextureEntry
  ): void {
    entry.canvas.destroy();
    entry.host.remove();
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
    canvas.selectionEvents.on("selection-state-changed", this.#refresh);
    canvas.canvas().addEventListener("wheel", this.#onWheel);
  }

  #unsubscribe(
    canvas: PixelArtCanvas
  ): void {
    for (const type of kUvRefreshEvents) {
      canvas.uv.off(type, this.#refresh);
    }
    canvas.selectionEvents.off("selection-state-changed", this.#refresh);
    canvas.canvas().removeEventListener("wheel", this.#onWheel);
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
