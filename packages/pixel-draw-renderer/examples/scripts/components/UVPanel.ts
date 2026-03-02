// Import Internal Dependencies
import type { UVMap, UVMapChangedDetail } from "../../../src/UVMap.ts";

export interface UVPanelOptions {
  listEl: HTMLElement;
  coordsEl: HTMLElement;
  uvMap: UVMap;
  /** Called when the user clicks a face in the list (before select is applied). */
  onFaceClick?: (id: string) => void;
}

/**
 * Manages the UV face-list sidebar: renders the region list, highlights the
 * selected region, and shows live u/v/w/h coordinates for the selection.
 */
export class UVPanel {
  #listEl: HTMLElement;
  #coordsEl: HTMLElement;
  #uvMap: UVMap;
  #onFaceClick: ((id: string) => void) | undefined;
  #onChanged: (event: Event) => void;

  constructor(options: UVPanelOptions) {
    this.#listEl = options.listEl;
    this.#coordsEl = options.coordsEl;
    this.#uvMap = options.uvMap;
    this.#onFaceClick = options.onFaceClick;

    this.#onChanged = (event: Event) => {
      const detail = (event as CustomEvent<UVMapChangedDetail>).detail;
      if (detail.type === "add" || detail.type === "remove") {
        this.#buildList();
      }
      this.#refreshSelection();
    };

    this.#uvMap.addEventListener("changed", this.#onChanged);
    this.#buildList();
    this.#refreshSelection();
  }

  destroy(): void {
    this.#uvMap.removeEventListener("changed", this.#onChanged);
  }

  #buildList(): void {
    this.#listEl.innerHTML = "";

    for (const region of this.#uvMap) {
      const item = document.createElement("div");
      item.className = "uv-face-item";
      item.dataset.id = region.id;

      const chip = document.createElement("span");
      chip.className = "uv-face-color";
      chip.style.background = region.color;
      item.appendChild(chip);

      const nameEl = document.createElement("span");
      nameEl.className = "uv-face-name";
      nameEl.textContent = region.label;
      item.appendChild(nameEl);

      item.addEventListener("click", () => {
        this.#onFaceClick?.(region.id);
        this.#uvMap.select(region.id);
      });

      this.#listEl.appendChild(item);
    }
  }

  #refreshSelection(): void {
    const selectedId = this.#uvMap.selectedId;

    for (const item of this.#listEl.querySelectorAll<HTMLElement>(".uv-face-item")) {
      const isSelected = item.dataset.id === selectedId;
      item.classList.toggle("active", isSelected);

      // Refresh label (in case it was renamed)
      const region = this.#uvMap.get(item.dataset.id ?? "");
      if (region) {
        const nameEl = item.querySelector(".uv-face-name");
        if (nameEl) {
          nameEl.textContent = region.label;
        }
      }
    }

    // Update coordinate display
    const region = selectedId ? this.#uvMap.get(selectedId) : null;
    if (region) {
      this.#coordsEl.style.display = "grid";
      this.#coordsEl.innerHTML =
        `<span class="uv-coord-label">u</span><span>${region.u.toFixed(3)}</span>` +
        `<span class="uv-coord-label">v</span><span>${region.v.toFixed(3)}</span>` +
        `<span class="uv-coord-label">w</span><span>${region.width.toFixed(3)}</span>` +
        `<span class="uv-coord-label">h</span><span>${region.height.toFixed(3)}</span>`;
    }
    else {
      this.#coordsEl.style.display = "none";
      this.#coordsEl.innerHTML = "";
    }
  }
}
