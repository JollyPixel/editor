// Import Third-party Dependencies
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import * as THREE from "three";

// CONSTANTS
const kRefreshInterval = 0.2;
const kHudStyle = [
  "position:absolute",
  "top:8px",
  "right:90px",
  "background:rgba(0,0,0,0.75)",
  "color:#88aaff",
  "font:11px/1.7 monospace",
  "padding:6px 10px",
  "border-radius:4px",
  "pointer-events:none",
  "z-index:100",
  "white-space:pre"
].join(";");

export class PerformanceHUD extends ActorComponent {
  #el: HTMLDivElement | null = null;
  #renderer: THREE.WebGLRenderer | null = null;
  #visible = true;
  #elapsed = 0;
  // Stored so the listener can be removed in destroy()
  #onKeyDown: (event: KeyboardEvent) => void;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "PerformanceHUD"
    });

    this.#onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F3") {
        event.preventDefault();
        this.#visible = !this.#visible;
        if (this.#el) {
          this.#el.style.display = this.#visible ? "block" : "none";
        }
      }
    };
  }

  awake() {
    this.#renderer = this.actor.world.renderer.getSource() as THREE.WebGLRenderer;

    const container = document.querySelector<HTMLElement>("#game-container")!;
    this.#el = document.createElement("div");
    this.#el.style.cssText = kHudStyle;
    container.appendChild(this.#el);

    document.addEventListener("keydown", this.#onKeyDown);
    this.#refresh();
  }

  update(dt: number) {
    this.#elapsed += dt;
    if (this.#elapsed >= kRefreshInterval) {
      this.#elapsed = 0;
      this.#refresh();
    }
  }

  #refresh() {
    if (!this.#el || !this.#renderer) {
      return;
    }

    const { render, memory } = this.#renderer.info;
    this.#el.textContent = [
      "PERF  [F3 to hide]",
      "─────────────────",
      `Draw Calls  ${render.calls}`,
      `Triangles   ${render.triangles.toLocaleString()}`,
      `Geometries  ${memory.geometries}`,
      `Textures    ${memory.textures}`
    ].join("\n");
  }

  override destroy() {
    document.removeEventListener("keydown", this.#onKeyDown);
    this.#el?.remove();
    this.#el = null;
  }
}
