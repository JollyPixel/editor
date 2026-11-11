// Import Third-party Dependencies
import {
  type AccessChange,
  type GameSection,
  type KindOptions,
  type ProjectSections,
  type ProjectSettingsReply,
  KindFilter,
  type ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";

// CONSTANTS
export const KIND_FILTER_CHANGE = "kind-filter-change";
export const GAME_CHANGE = "game-change";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replace"
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
    return this.#replace(() => this.#client.replace("kinds", kinds));
  }

  replaceAccess(
    change: AccessChange
  ): Promise<boolean> {
    return this.#replace(() => this.#client.replace("access", change));
  }

  replaceKindFilter(
    kindFilter: KindFilter
  ): Promise<boolean> {
    return this.#replace(
      () => this.#client.replace("kindFilter", kindFilter.toJSON())
    );
  }

  replaceGame(
    game: GameSection
  ): Promise<boolean> {
    return this.#replace(() => this.#client.replace("game", game));
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
