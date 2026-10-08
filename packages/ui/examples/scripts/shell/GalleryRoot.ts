// Import Third-party Dependencies
import { adoptStyles } from "lit";

// Import Internal Dependencies
import "../../../src/containers/dock/Dock.ts";
import "../../../src/containers/folder/Folder.ts";
import "../../../src/controls/Checkbox.ts";
import "../../../src/theme/components/ThemePreferences.ts";
import { detailOf } from "../../../src/dom.ts";
import { themeStyles } from "../../../src/theme/styles/themeStyles.ts";
import type { Checkbox } from "../../../src/controls/Checkbox.ts";
import { manifest } from "../manifest.ts";
import { groupLabelOf } from "../groups.ts";
import { exampleStyles } from "../examples/shared/exampleStyles.ts";
import { shellStyles } from "./styles.ts";
import type {
  GalleryOption,
  GalleryOptionValues
} from "../types.ts";

export class GalleryRoot extends HTMLElement {
  #exampleHost = document.createElement("main");
  #optionsPanel = document.createElement("aside");
  #options: readonly GalleryOption[] = [];
  #checkboxes = new Map<string, Checkbox>();
  #links = new Map<string, HTMLAnchorElement>();
  #activeLink: HTMLAnchorElement | null = null;

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
    adoptStyles(root, [
      themeStyles,
      shellStyles,
      exampleStyles
    ]);

    const layout = document.createElement("div");
    layout.className = "layout";
    layout.dataset.chrome = this.getAttribute("chrome") ?? "on";

    if (layout.dataset.chrome !== "off") {
      layout.append(this.#buildDock());
    }
    layout.append(this.#exampleHost);
    if (layout.dataset.chrome !== "off") {
      this.#optionsPanel.className = "options";
      this.#optionsPanel.hidden = true;
      layout.append(this.#optionsPanel);
    }
    root.append(layout);
  }

  showOptions(
    options: readonly GalleryOption[],
    values: GalleryOptionValues
  ) {
    if (options !== this.#options) {
      this.#options = options;
      this.#buildOptions();
    }

    for (const [key, checkbox] of this.#checkboxes) {
      checkbox.value = values[key];
    }
  }

  setActive(
    id: string
  ) {
    this.#activeLink?.removeAttribute("aria-current");
    this.#activeLink = this.#links.get(id) ?? null;
    this.#activeLink?.setAttribute("aria-current", "page");
  }

  #buildOptions() {
    const heading = document.createElement("h3");
    heading.textContent = "Options";

    this.#checkboxes.clear();
    this.#optionsPanel.hidden = this.#options.length === 0;
    this.#optionsPanel.replaceChildren(
      heading,
      ...this.#options.map((option) => this.#buildOption(option))
    );
  }

  #buildOption(
    option: GalleryOption
  ): Checkbox {
    const checkbox = document.createElement("jolly-checkbox");
    checkbox.label = option.label;
    checkbox.clickableBackground = true;
    checkbox.align = "end";
    checkbox.dataset.option = option.key;
    checkbox.addEventListener("jolly-change", (event) => {
      const detail = detailOf<{ value: boolean; }>(event);
      if (detail === null) {
        return;
      }

      const customEvent = new CustomEvent(
        "gallery-option",
        {
          detail: {
            key: option.key,
            value: detail.value
          }
        }
      );
      this.dispatchEvent(customEvent);
    });
    this.#checkboxes.set(option.key, checkbox);

    return checkbox;
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
    pane.addEventListener("click", (event) => this.#navigate(event));
    pane.append(...this.#buildGroups());
    pane.append(this.#buildPreferences());
    dock.append(pane);

    return dock;
  }

  #navigate(
    event: MouseEvent
  ) {
    const link = event.target instanceof Element ?
      event.target.closest<HTMLAnchorElement>("a[data-example-id]") :
      null;
    if (link === null) {
      return;
    }

    event.preventDefault();
    const customEvent = new CustomEvent(
      "gallery-select",
      {
        detail: { id: link.dataset.exampleId }
      }
    );
    this.dispatchEvent(customEvent);
  }

  #buildGroups(): HTMLElement[] {
    const groups = new Map<string, HTMLElementTagNameMap["jolly-folder"]>();
    const navs = new Map<string, HTMLElement>();
    for (const example of manifest) {
      const label = groupLabelOf(example.id);
      let nav = navs.get(label);
      if (nav === undefined) {
        const folder = document.createElement("jolly-folder");
        folder.label = label;
        nav = document.createElement("nav");
        nav.setAttribute("aria-label", `${label} examples`);
        folder.append(nav);
        groups.set(label, folder);
        navs.set(label, nav);
      }

      nav.append(
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
