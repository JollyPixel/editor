// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
const kImportMapStart = "<script type=\"importmap\">";
const kScriptEnd = "</script>";
const kHeadStart = /<head(?:\s[^>]*)?>/i;
const kImportMapSchema = z.object({
  imports: z.record(z.string(), z.string()).default({})
});

export type ModuleImports = Readonly<Record<string, string>>;

export class PlayerPage {
  static parse(
    html: string
  ): PlayerPage {
    const start = html.indexOf(kImportMapStart);
    const contentStart = start + kImportMapStart.length;
    const end = start === -1 ? -1 : html.indexOf(kScriptEnd, contentStart);
    if (end === -1) {
      return new PlayerPage(html, {});
    }

    const { imports } = kImportMapSchema.parse(
      JSON.parse(html.slice(contentStart, end))
    );
    const rest = html.slice(end + kScriptEnd.length).trimStart();

    return new PlayerPage(html.slice(0, start) + rest, imports);
  }

  readonly imports: ModuleImports;

  #html: string;

  constructor(
    html: string,
    imports: ModuleImports
  ) {
    this.#html = html;
    this.imports = { ...imports };
  }

  withImports(
    imports: ModuleImports
  ): PlayerPage {
    return new PlayerPage(this.#html, {
      ...this.imports,
      ...imports
    });
  }

  toString(): string {
    if (Object.keys(this.imports).length === 0) {
      return this.#html;
    }

    const map = JSON.stringify({ imports: this.imports })
      .replaceAll("<", "\\u003c");
    const tag = `<script type="importmap">${map}</script>`;
    const head = kHeadStart.exec(this.#html);
    if (head === null) {
      return `${tag}${this.#html}`;
    }

    const end = head.index + head[0].length;

    return `${this.#html.slice(0, end)}${tag}${this.#html.slice(end)}`;
  }
}
