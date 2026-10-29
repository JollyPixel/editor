// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";
import type {
  AccessChange,
  KindOptions,
  ProjectSettingsReply
} from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import type { ProjectRights } from "../../shared/ProjectRights.ts";

// CONSTANTS
export const KIND_FILTER_CHANGE = "kind-filter-change";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replaceKinds" | "replaceAccess" | "replaceKindFilter"
>;

export class StudioProjectSettings extends RemoteState {
  readonly rights: ProjectRights;

  #client: ProjectSettingsSource;
  #data: ProjectSettingsReply | null = null;
  #kindFilter: KindFilter;

  constructor(
    client: ProjectSettingsSource,
    rights: ProjectRights,
    kindFilter: KindFilter
  ) {
    super();
    this.#client = client;
    this.rights = rights;
    this.#kindFilter = kindFilter;
  }

  get data(): ProjectSettingsReply | null {
    return this.#data;
  }

  get kindFilter(): KindFilter {
    return this.#kindFilter;
  }

  get canEdit(): boolean {
    return this.rights.allows("editSettings");
  }

  async load(): Promise<void> {
    await this.#replace(() => this.#client.read());
  }

  replaceKinds(
    kinds: KindOptions
  ): Promise<boolean> {
    return this.#replace(() => this.#client.replaceKinds(kinds));
  }

  replaceAccess(
    change: AccessChange
  ): Promise<boolean> {
    return this.#replace(() => this.#client.replaceAccess(change));
  }

  replaceKindFilter(
    kindFilter: KindFilter
  ): Promise<boolean> {
    return this.#replace(
      () => this.#client.replaceKindFilter(kindFilter.toJSON())
    );
  }

  async #replace(
    request: () => Promise<ProjectSettingsReply>
  ): Promise<boolean> {
    const data = await this.run(request, (reply) => {
      this.#data = reply;
      const kindFilter = KindFilter.from(reply.kindFilter);
      if (!kindFilter.equals(this.#kindFilter)) {
        this.#kindFilter = kindFilter;
        this.dispatchEvent(new Event(KIND_FILTER_CHANGE));
      }
    });

    return data !== null;
  }
}
