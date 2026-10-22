// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { AuditClient } from "./AuditClient.ts";
import {
  AuditFilters,
  type AuditFiltersData
} from "./AuditFilters.ts";
import type { AuditRow } from "../../shared/api/audit.ts";

export type AuditPageSource = Pick<AuditClient, "page">;

export class AuditPages extends RemoteState {
  #client: AuditPageSource;
  #filters = AuditFilters.NONE;
  #rows: readonly AuditRow[] = [];
  #next: string | null = null;

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
    await this.latest(
      () => this.#client.page(this.#filters.toQuery(cursor)),
      (page) => {
        this.#rows = cursor === undefined ? page.rows : [...this.#rows, ...page.rows];
        this.#next = page.next;
      }
    );
  }
}
