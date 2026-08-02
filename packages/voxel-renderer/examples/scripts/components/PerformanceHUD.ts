// Import Third-party Dependencies
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import * as THREE from "three";

// CONSTANTS
const kSeparator = "─".repeat(30);
const kLabelWidth = 13;
const kBytesPerMebibyte = 1024 * 1024;
const kHudStyle = [
  "position:fixed",
  "top:12px",
  "right:12px",
  "background:rgba(0,0,0,0.72)",
  "color:#88aaff",
  "font:11px/1.6 monospace",
  "padding:8px 12px",
  "border-radius:4px",
  "pointer-events:none",
  "z-index:1000",
  "white-space:pre"
].join(";");

export interface PerformanceHUDOptions {
  /**
   * @default "PERF"
   */
  title?: string;
  /**
   * Key toggling the panel on and off.
   * @default "F3"
   */
  toggleKey?: string;
  /**
   * Seconds between two refreshes. Metrics are averaged over that window.
   * @default 0.25
   */
  refreshInterval?: number;
  /**
   * Extra lines appended under the renderer metrics, re-evaluated on every
   * refresh. Use `hudLine()` to keep them aligned.
   */
  details?: () => string[];
}

/**
 * Formats a `label  value` pair aligned with the built-in metrics.
 */
export function hudLine(
  label: string,
  value: string | number
): string {
  const text = typeof value === "number" ? value.toLocaleString("en-US") : value;

  return label.padEnd(kLabelWidth) + text;
}

/**
 * Renderer statistics overlay: framerate, draw calls, triangle count and heap
 * usage, plus any caller-provided detail lines.
 */
export class PerformanceHUD extends ActorComponent {
  #element: HTMLDivElement | null = null;
  #renderer: THREE.WebGLRenderer | null = null;
  #title: string;
  #toggleKey: string;
  #refreshInterval: number;
  #details?: () => string[];

  #visible = true;
  #elapsed = 0;
  #frames = 0;
  #worstFrame = 0;

  // Kept so the listener can be removed on destroy().
  #onKeyDown: (event: KeyboardEvent) => void;

  constructor(
    actor: Actor,
    options: PerformanceHUDOptions = {}
  ) {
    super({
      actor,
      typeName: "PerformanceHUD"
    });

    const {
      title = "PERF",
      toggleKey = "F3",
      refreshInterval = 0.25,
      details
    } = options;

    this.#title = title;
    this.#toggleKey = toggleKey;
    this.#refreshInterval = refreshInterval;
    this.#details = details;

    this.#onKeyDown = (event) => {
      if (event.key !== this.#toggleKey) {
        return;
      }

      event.preventDefault();
      this.#visible = !this.#visible;
      if (this.#element) {
        this.#element.style.display = this.#visible ? "block" : "none";
      }
    };
  }

  awake(): void {
    this.#renderer = this.actor.world.renderer.getSource();

    this.#element = document.createElement("div");
    this.#element.style.cssText = kHudStyle;
    document.body.appendChild(this.#element);

    document.addEventListener("keydown", this.#onKeyDown);
    this.#refresh(0, 0);
  }

  update(
    deltaTime: number
  ): void {
    this.#frames++;
    this.#elapsed += deltaTime;
    this.#worstFrame = Math.max(this.#worstFrame, deltaTime);

    if (this.#elapsed < this.#refreshInterval) {
      return;
    }

    this.#refresh(this.#frames / this.#elapsed, this.#worstFrame);
    this.#elapsed = 0;
    this.#frames = 0;
    this.#worstFrame = 0;
  }

  #refresh(
    fps: number,
    worstFrame: number
  ): void {
    if (!this.#element || !this.#renderer) {
      return;
    }

    const { render, memory } = this.#renderer.info;
    const lines = [
      `${this.#title}  [${this.#toggleKey} to hide]`,
      kSeparator,
      hudLine("FPS", `${Math.round(fps)}  (worst ${(worstFrame * 1000).toFixed(1)} ms)`),
      hudLine("Draw Calls", render.calls),
      hudLine("Triangles", render.triangles),
      hudLine("Geometries", memory.geometries),
      hudLine("Textures", memory.textures)
    ];

    const heap = readHeapMebibytes();
    if (heap !== null) {
      lines.push(hudLine("JS Heap", `${Math.round(heap)} MiB`));
    }

    const details = this.#details?.() ?? [];
    if (details.length > 0) {
      lines.push(kSeparator, ...details);
    }

    this.#element.textContent = lines.join("\n");
  }

  override destroy(): void {
    document.removeEventListener("keydown", this.#onKeyDown);
    this.#element?.remove();
    this.#element = null;

    super.destroy();
  }
}

/**
 * `performance.memory` is a non-standard Chromium extension; probe it
 * structurally and report nothing on browsers that do not expose it.
 */
function readHeapMebibytes(): number | null {
  const memory: unknown = "memory" in performance ? performance.memory : null;

  if (
    typeof memory === "object" &&
    memory !== null &&
    "usedJSHeapSize" in memory &&
    typeof memory.usedJSHeapSize === "number"
  ) {
    return memory.usedJSHeapSize / kBytesPerMebibyte;
  }

  return null;
}
