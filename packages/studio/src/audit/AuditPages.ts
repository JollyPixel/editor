// Import Internal Dependencies
import type { AuditClient } from "./AuditClient.ts";
import {
  AuditFilters,
  type AuditFiltersData
} from "./AuditFilters.ts";
import type { AuditRow } from "../../shared/api/audit.ts";

// CONSTANTS
export const AUDIT_PAGES_CHANGE = "change";

export type AuditPageSource = Pick<AuditClient, "page">;

export class AuditPages extends EventTarget {
  #client: AuditPageSource;
  #filters = AuditFilters.NONE;
  #rows: readonly AuditRow[] = [];
  #next: string | null = null;
  #loading = false;
  #error: string | null = null;
  #request = 0;

  constructor(
    client: AuditPageSource
  ) {
    super();
    this.#client = client;
  }

  get filters(): AuditFilters {
    return this.#filters;
  }

  get rows(): readonly AuditRow[] {
    return this.#rows;
  }

  get hasMore(): boolean {
    return this.#next !== null;
  }

  get loading(): boolean {
    return this.#loading;
  }

  get error(): string | null {
    return this.#error;
  }

  filter(
    patch: AuditFiltersData
  ): Promise<void> {
    this.#filters = this.#filters.with(patch);

    return this.reload();
  }

  reload(): Promise<void> {
    return this.#load(undefined);
  }

  more(): Promise<void> {
    return this.#next === null ? Promise.resolve() : this.#load(this.#next);
  }

  async #load(
    cursor: string | undefined
  ): Promise<void> {
    const request = ++this.#request;
    this.#loading = true;
    this.#changed();
    try {
      const page = await this.#client.page(this.#filters.toQuery(cursor));
      if (request !== this.#request) {
        return;
      }
      this.#rows = cursor === undefined ? page.rows : [...this.#rows, ...page.rows];
      this.#next = page.next;
      this.#error = null;
    }
    catch (error) {
      if (request === this.#request) {
        this.#error = error instanceof Error ? error.message : String(error);
      }
    }
    finally {
      if (request === this.#request) {
        this.#loading = false;
        this.#changed();
      }
    }
  }

  #changed(): void {
    this.dispatchEvent(new Event(AUDIT_PAGES_CHANGE));
  }
}
