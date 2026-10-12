// Import Internal Dependencies
import {
  documentThemeMode,
  type ResolvedThemeMode
} from "./ambientTheme.ts";
import { systemThemeMode } from "./systemTheme.ts";
import { ThemeChangeObserver } from "./ThemeChangeObserver.ts";

export class DocumentTheme {
  #document: Document;

  constructor(
    doc: Document = document
  ) {
    this.#document = doc;
  }

  get mode(): ResolvedThemeMode {
    return documentThemeMode(this.#document) ??
      systemThemeMode(this.#document.defaultView);
  }

  follow(
    onChange: (mode: ResolvedThemeMode) => void
  ): () => void {
    let followed = this.mode;
    const observer = new ThemeChangeObserver(() => {
      const mode = this.mode;
      if (mode !== followed) {
        followed = mode;
        onChange(mode);
      }
    });
    observer.observe(this.#document);

    return () => observer.disconnect();
  }
}
