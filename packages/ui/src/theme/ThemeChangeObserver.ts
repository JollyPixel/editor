// Import Internal Dependencies
import { PREFERS_DARK_QUERY } from "./systemTheme.ts";

export class ThemeChangeObserver {
  #callback: () => void;
  #mutations: MutationObserver | null = null;
  #ignored: Node | null = null;
  #view: Window | null = null;
  #prefersDark: MediaQueryList | null = null;
  #frame: number | null = null;

  constructor(
    callback: () => void
  ) {
    this.#callback = callback;
  }

  observe(
    doc: Document,
    ignored: Node | null = null
  ): void {
    this.disconnect();
    this.#view = doc.defaultView;
    this.#ignored = ignored;
    this.#mutations ??= new MutationObserver(this.#onMutations);
    this.#mutations.observe(doc, {
      attributes: true,
      attributeFilter: ["theme"],
      subtree: true
    });
    this.#prefersDark = this.#view?.matchMedia(PREFERS_DARK_QUERY) ?? null;
    this.#prefersDark?.addEventListener("change", this.#schedule);
  }

  disconnect(): void {
    this.#mutations?.disconnect();
    this.#prefersDark?.removeEventListener("change", this.#schedule);
    this.#prefersDark = null;
    if (this.#frame !== null) {
      this.#view?.cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.#view = null;
  }

  readonly #onMutations = (
    records: Array<MutationRecord>
  ): void => {
    if (!records.every((record) => record.target === this.#ignored)) {
      this.#schedule();
    }
  };

  readonly #schedule = (): void => {
    const view = this.#view;
    if (view === null || this.#frame !== null) {
      return;
    }

    this.#frame = view.requestAnimationFrame(() => {
      this.#frame = null;
      this.#callback();
    });
  };
}
