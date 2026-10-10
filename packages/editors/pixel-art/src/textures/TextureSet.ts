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
  TextureEntry,
  type PixelDrawTextureOptions,
  type TextureUpdate
} from "./TextureEntry.ts";
import { ToolSettings } from "../tools/ToolSettings.ts";
import {
  PIXEL_ART_CAPABILITIES,
  type PixelArtAccess
} from "../access/PixelArtAccess.ts";
import {
  UvAccessPolicy,
  type UvAccess
} from "../uv/UvAccessPolicy.ts";

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
  #uvResizable = false;
  #uvOverflow = 0;
  #uvAccess: UvAccess = "edit";

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

  get activeAccess(): PixelArtAccess {
    return this.#active?.access ?? PIXEL_ART_CAPABILITIES.full;
  }

  get activeUvPolicy(): UvAccessPolicy {
    return this.#uvPolicy(this.activeAccess);
  }

  set uvAccess(
    value: UvAccess
  ) {
    this.#uvAccess = value;
    for (const entry of this.#entries.values()) {
      this.#applyAccess(entry);
    }
  }

  set uvResizable(
    value: boolean
  ) {
    this.#uvResizable = value;
    for (const { canvas } of this.#entries.values()) {
      canvas.tools.uv.resizable = value;
    }
  }

  set uvOverflow(
    value: number
  ) {
    this.#uvOverflow = value;
    for (const { canvas } of this.#entries.values()) {
      canvas.uv.overflow = value;
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
      badge = "",
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
    this.#options.container().append(host);
    this.#show(host);

    let canvas: PixelArtCanvas;
    try {
      canvas = this.#createCanvas(host, {
        ...canvasOptions,
        defaultMode: this.#uvPolicy(access).constrain(
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
      badge,
      disabled,
      access,
      host,
      canvas
    });
    this.#applyAccess(entry);
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
    entry.update(changes);
    if (changes.access !== undefined) {
      this.#applyAccess(entry);
    }
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
      this.#applyAccess(entry);
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

    const next = entry === this.#active ? this.#replacementFor(entry) : null;
    this.#entries.delete(id);

    if (next !== null) {
      this.activate(next);
    }
    else if (entry === this.#active) {
      this.#deactivate();
    }

    entry.destroy();
    this.#host.requestUpdate();

    return next;
  }

  clear(): void {
    this.#deactivate();
    for (const entry of this.#entries.values()) {
      entry.destroy();
    }
    this.#entries.clear();
  }

  #replacementFor(
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
      uv: {
        ...options.uv,
        resizable: this.#uvResizable
      },
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
    canvas.uv.overflow = this.#uvOverflow;

    return canvas;
  }

  #uvPolicy(
    access: PixelArtAccess
  ): UvAccessPolicy {
    return UvAccessPolicy.forAccess(this.#uvAccess, access.has("uv"));
  }

  #applyAccess(
    entry: TextureEntry
  ): void {
    const { canvas, access } = entry;
    const policy = this.#uvPolicy(access);
    canvas.mode = policy.constrain(canvas.mode);
    if (!policy.fillClip) {
      canvas.tools.fill.uvClip = false;
    }
    canvas.pixelsLocked = !access.has("pixels");
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
