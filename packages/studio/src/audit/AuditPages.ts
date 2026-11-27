// Import Third-party Dependencies
import type {
  AuditActor,
  AuditRow
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { AuditClient } from "./AuditClient.ts";
import {
  AuditFilters,
  type AuditFiltersData
} from "./AuditFilters.ts";

export type AuditPageSource = Pick<AuditClient, "page" | "actors" | "export">;

export class AuditPages extends RemoteState {
  #client: AuditPageSource;
  #filters = AuditFilters.NONE;
  #rows: readonly AuditRow[] = [];
  #actors: readonly AuditActor[] = [];
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

  get actors(): readonly AuditActor[] {
    return this.#actors;
  }

  async export(): Promise<void> {
    await this.run(
      () => this.#client.export(this.#filters.toQuery()),
      (download) => download.save()
    );
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

  async refresh(): Promise<void> {
    await Promise.all([
      this.reload(),
      this.run(
        () => this.#client.actors(),
        (actors) => {
          this.#actors = actors;
        }
      )
    ]);
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
