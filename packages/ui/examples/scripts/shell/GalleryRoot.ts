// Import Internal Dependencies
import { themeStyles } from "../../../src/index.ts";
import { manifest } from "../manifest.ts";
import { shellStyles } from "./styles.ts";

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

    const root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`${themeStyles.cssText}\n${shellStyles}`);
    root.adoptedStyleSheets = [sheet];

    const layout = document.createElement("div");
    layout.className = "layout";
    layout.dataset.chrome = this.getAttribute("chrome") ?? "on";

    if (layout.dataset.chrome !== "off") {
      layout.append(this.#buildNav());
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

  #buildNav(): HTMLElement {
    const nav = document.createElement("nav");
    let currentGroup = "";

    for (const example of manifest) {
      if (example.group !== currentGroup) {
        currentGroup = example.group;
        const title = document.createElement("div");
        title.className = "group-title";
        title.textContent = currentGroup;
        nav.append(title);
      }

      nav.append(this.#buildLink(example.id, example.title));
    }

    return nav;
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
      this.dispatchEvent(new CustomEvent("gallery-select", { detail: { id } }));
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
