// CONSTANTS
const kProtocol = "jolly-docs:";

export interface DocsPage {
  readonly id: string;
  readonly title: string;
  load(): Promise<string>;
}

export interface DocsSection {
  readonly label?: string;
  readonly pages: readonly DocsPage[];
}

export interface DocsBook {
  readonly label: string;
  readonly sections: readonly DocsSection[];
}

export type DocsLink = DocsPage | "external" | "missing";

export class DocsLibrary {
  static readonly EMPTY = new DocsLibrary([]);

  readonly books: readonly DocsBook[];
  #pages = new Map<string, DocsPage>();

  constructor(
    books: readonly DocsBook[]
  ) {
    this.books = books;
    for (const book of books) {
      for (const section of book.sections) {
        for (const page of section.pages) {
          this.#pages.set(page.id, page);
        }
      }
    }
  }

  get ids(): string[] {
    return [...this.#pages.keys()];
  }

  get first(): DocsPage | undefined {
    return this.#pages.values().next().value;
  }

  find(
    id: string
  ): DocsPage | undefined {
    return this.#pages.get(id);
  }

  link(
    from: DocsPage,
    href: string
  ): DocsLink {
    try {
      const url = new URL(href, `${kProtocol}/${from.id}`);
      if (url.protocol !== kProtocol) {
        return "external";
      }

      const page = this.find(decodeURIComponent(url.pathname.slice(1)));

      return page ?? "missing";
    }
    catch {
      return "missing";
    }
  }
}
