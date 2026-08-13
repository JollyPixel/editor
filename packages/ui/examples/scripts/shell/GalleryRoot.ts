// Import Internal Dependencies
import {
  themeStyles
} from "../../../src/index.ts";
import { manifest } from "../manifest.ts";
import { exampleStyles } from "../examples/shared/exampleStyles.ts";
import { shellStyles } from "./styles.ts";

// CONSTANTS
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
      `${themeStyles.cssText}\n${shellStyles}\n${exampleStyles}`
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
    pane.className = "gallery-pane";
    pane.heading = "@jolly-pixel/ui";
    pane.reorderable = true;
    pane.storageKey = "jolly-ui-gallery:navigation";
    pane.append(...this.#buildGroups());
    pane.append(this.#buildPreferences());
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

  #buildPreferences(): HTMLElementTagNameMap["jolly-theme-preferences"] {
    const preferences = document.createElement("jolly-theme-preferences");
    const theme = this.getAttribute("theme");
    preferences.slot = "actions";
    preferences.storageKey = "jolly-ui-gallery";
    preferences.defaultTheme = theme === "dark" ? "dark" : "light";
    preferences.target = this;

    return preferences;
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
