// Import Internal Dependencies
import {
  EDITOR_PAGES_PATH,
  type EditorDescriptor
} from "./EditorDescriptor.ts";

// CONSTANTS
const kEagerFiles = [
  "script[type=\"module\"][src]",
  "link[rel=\"modulepreload\"][href]",
  "link[rel=\"stylesheet\"][href]"
].join(", ");

export class EditorPrefetch {
  readonly #pages: URL[];

  constructor(
    editors: Iterable<EditorDescriptor>,
    base: string | URL
  ) {
    this.#pages = Array.from(
      editors,
      ({ name }) => new URL(`${EDITOR_PAGES_PATH}${name}/`, base)
    );
  }

  async run(): Promise<void> {
    await Promise.allSettled(
      this.#pages.map((page) => this.#prefetchPage(page))
    );
  }

  async #prefetchPage(
    page: URL
  ): Promise<void> {
    const response = await fetch(page, { priority: "low" });
    if (!response.ok) {
      return;
    }

    const html = new DOMParser().parseFromString(
      await response.text(),
      "text/html"
    );
    const files = Array.from(
      html.querySelectorAll(kEagerFiles),
      (element) => new URL(
        element.getAttribute("src") ?? element.getAttribute("href")!,
        page
      )
    );
    await Promise.allSettled(files.map(async(file) => {
      const fileResponse = await fetch(file, { priority: "low" });
      await fileResponse.arrayBuffer();
    }));
  }
}
