// Import Internal Dependencies
import {
  LocalStorageAdapter,
  detailOf,
  themeStyles,
  type Density,
  type ThemeMode
} from "../../../src/index.ts";
import { manifest } from "../manifest.ts";
import { shellStyles } from "./styles.ts";

// CONSTANTS
const kThemeKey = "jolly-ui-gallery:theme";
const kDensityKey = "jolly-ui-gallery:density";

/**
 * The gallery's scope host. Tokens declare against `:host`, which only resolves in a shadow root,
 * so the gallery needs one even before any component exists.
 *
 * P2 swaps the nav and main for `jolly-dock` and `jolly-list`. Routing lives in `main.ts` and does
 * not move, so that swap rewrites no test.
 */
export class GalleryRoot extends HTMLElement {
  #exampleHost = document.createElement("main");
  #links = new Map<string, HTMLAnchorElement>();
  #storage = new LocalStorageAdapter();
  #pane: HTMLElementTagNameMap["jolly-pane"] | null = null;

  get exampleHost(): HTMLElement {
    return this.#exampleHost;
  }

  connectedCallback() {
    if (this.shadowRoot !== null) {
      return;
    }

    const root = this.attachShadow({
      mode: "open"
    });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      `${themeStyles.cssText}\n${shellStyles}`
    );
    root.adoptedStyleSheets = [sheet];

    const layout = document.createElement("div");
    layout.className = "layout";
    layout.dataset.chrome = this.getAttribute("chrome") ?? "on";

    if (layout.dataset.chrome !== "off") {
      layout.append(this.#buildDock());
    }
    layout.append(this.#exampleHost);
    root.append(layout);
  }

  setActive(
    id: string
  ) {
    for (const [linkId, link] of this.#links) {
      if (linkId === id) {
        link.setAttribute("aria-current", "page");
      }
      else {
        link.removeAttribute("aria-current");
      }
    }
  }

  #buildDock(): HTMLElement {
    const dock = document.createElement("jolly-dock");
    dock.side = "left";
    dock.collapsible = true;
    dock.storageKey = "jolly-ui-gallery:dock";

    const pane = document.createElement("jolly-pane");
    pane.title = "@jolly-pixel/ui";
    pane.reorderable = true;
    pane.storageKey = "jolly-ui-gallery:navigation";
    pane.append(...this.#buildGroups());
    pane.append(
      this.#buildThemeControl(),
      this.#buildDensityControl()
    );
    this.#pane = pane;
    this.#applyPreferences();
    dock.append(pane);

    return dock;
  }

  #buildGroups(): HTMLElement[] {
    const groups = new Map<string, HTMLElementTagNameMap["jolly-folder"]>();
    for (const example of manifest) {
      let folder = groups.get(example.group);
      if (folder === undefined) {
        folder = document.createElement("jolly-folder");
        folder.label = example.group;
        const nav = document.createElement("nav");
        nav.setAttribute("aria-label", `${example.group} examples`);
        folder.append(nav);
        groups.set(example.group, folder);
      }

      folder.querySelector("nav")?.append(
        this.#buildLink(example.id, example.title)
      );
    }

    return [...groups.values()];
  }

  #buildThemeControl(): HTMLElementTagNameMap["jolly-button-group"] {
    const control = document.createElement("jolly-button-group");
    control.slot = "actions";
    control.label = "Theme";
    control.options = [
      {
        value: "light",
        label: "Light"
      },
      {
        value: "dark",
        label: "Dark"
      }
    ];
    control.value = this.#theme();
    control.addEventListener("jolly-change", (event) => {
      const detail = detailOf<{ value: ThemeMode; }>(event);
      if (detail === null) {
        return;
      }

      const { value } = detail;
      this.#storage.set(kThemeKey, value);
      this.setAttribute("theme", value);
      this.#pane?.setAttribute("theme", value);
      control.value = value;
    });

    return control;
  }

  #buildDensityControl(): HTMLElementTagNameMap["jolly-select"] {
    const control = document.createElement("jolly-select");
    control.slot = "actions";
    control.label = "Density";
    control.options = [
      {
        value: "compact",
        label: "Compact"
      },
      {
        value: "default",
        label: "Default"
      },
      {
        value: "comfortable",
        label: "Comfortable"
      }
    ];
    control.value = this.#density();
    control.addEventListener("jolly-change", (event) => {
      const detail = detailOf<{ value: Density; }>(event);
      if (detail === null) {
        return;
      }

      const { value } = detail;
      this.#storage.set(kDensityKey, value);
      this.setAttribute("density", value);
      this.#pane?.setAttribute("density", value);
      control.value = value;
    });

    return control;
  }

  #applyPreferences(): void {
    const theme = this.#theme();
    const density = this.#density();
    this.setAttribute("theme", theme);
    this.setAttribute("density", density);
    this.#pane?.setAttribute("theme", theme);
    this.#pane?.setAttribute("density", density);
  }

  #theme(): ThemeMode {
    const value = this.getAttribute("theme") ?? this.#storage.get(kThemeKey);

    return value === "dark" ? "dark" : "light";
  }

  #density(): Density {
    const value = this.#storage.get(kDensityKey);

    return value === "compact" || value === "comfortable" ? value : "default";
  }

  #buildLink(
    id: string,
    title: string
  ): HTMLAnchorElement {
    const link = document.createElement("a");
    link.href = `?example=${encodeURIComponent(id)}`;
    link.textContent = title;
    link.dataset.exampleId = id;
    link.addEventListener("click", (event) => {
      event.preventDefault();

      const customEvent = new CustomEvent(
        "gallery-select",
        {
          detail: { id }
        }
      );
      this.dispatchEvent(customEvent);
    });
    this.#links.set(id, link);

    return link;
  }
}

customElements.define("gallery-root", GalleryRoot);

declare global {
  interface HTMLElementTagNameMap {
    "gallery-root": GalleryRoot;
  }
}
