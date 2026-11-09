// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";
import type {
  AccessChange,
  GameSection,
  KindOptions,
  ProjectSections,
  ProjectSettingsReply
} from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
import type { ProjectRights } from "../../shared/ProjectRights.ts";

// CONSTANTS
export const KIND_FILTER_CHANGE = "kind-filter-change";
export const GAME_CHANGE = "game-change";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replaceKinds" | "replaceAccess" | "replaceKindFilter" | "replaceGame"
>;

export class StudioProjectSettings extends RemoteState {
  readonly rights: ProjectRights;

  #client: ProjectSettingsSource;
  #data: ProjectSettingsReply | null = null;
  #kindFilter: KindFilter;
  #game: GameSection;

  constructor(
    client: ProjectSettingsSource,
    rights: ProjectRights,
    sections: ProjectSections
  ) {
    super();
    this.#client = client;
    this.rights = rights;
    this.#kindFilter = KindFilter.from(sections.kindFilter);
    this.#game = sections.game;
  }

  get data(): ProjectSettingsReply | null {
    return this.#data;
  }

  get kindFilter(): KindFilter {
    return this.#kindFilter;
  }

  get game(): GameSection {
    return this.#game;
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

  replaceGame(
    game: GameSection
  ): Promise<boolean> {
    return this.#replace(() => this.#client.replaceGame(game));
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
      if (reply.game.start !== this.#game.start) {
        this.#game = reply.game;
        this.dispatchEvent(new Event(GAME_CHANGE));
      }
    });

    return data !== null;
  }
}
