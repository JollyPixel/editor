// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import { insertInHead } from "../http/insertInHead.ts";

// CONSTANTS
const kImportMapStart = "<script type=\"importmap\">";
const kScriptEnd = "</script>";
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

    return insertInHead(
      this.#html,
      `<script type="importmap">${map}</script>`
    );
  }
}
