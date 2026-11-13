// Import Third-party Dependencies
import {
  type ApiFailureCode,
  type GameSection,
  type ProjectSections,
  type ProjectSettingsReply,
  KindFilter,
  type ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  REMOTE_STATE_CHANGE,
  RemoteState
} from "../api/RemoteState.ts";
import { ProjectDrafts } from "./ProjectDrafts.ts";
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";

// CONSTANTS
export const KIND_FILTER_CHANGE = "kind-filter-change";
export const GAME_CHANGE = "game-change";
const kStaleSettings: ApiFailureCode = "stale-settings";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replace"
>;

export class StudioProjectSettings extends RemoteState {
  readonly rights: ProjectRights;
  readonly drafts: ProjectDrafts;

  #client: ProjectSettingsSource;
  #data: ProjectSettingsReply | null = null;
  #kindFilter: KindFilter;
  #game: GameSection;
  #reading: Promise<boolean> | null = null;

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
    this.drafts = new ProjectDrafts(
      () => this.dispatchEvent(new Event(REMOTE_STATE_CHANGE))
    );
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

  get conflict(): boolean {
    return this.errorCode === kStaleSettings;
  }

  load(): Promise<boolean> {
    this.#reading ??= this.#replace(() => this.#client.read()).finally(() => {
      this.#reading = null;
    });

    return this.#reading;
  }

  async save(): Promise<boolean> {
    const data = this.#data;
    if (data === null || !this.drafts.changed) {
      return false;
    }

    const saved = await this.#replace(() => this.#client.replace({
      revision: data.revision,
      sections: this.drafts.sections()
    }));
    if (saved) {
      this.discard();
    }

    return saved;
  }

  async overwrite(): Promise<boolean> {
    return await this.load() && this.save();
  }

  async reload(): Promise<void> {
    this.discard();
    await this.load();
  }

  discard(): void {
    this.drafts.discard();
    this.dispatchEvent(new Event(REMOTE_STATE_CHANGE));
  }

  async #replace(
    request: () => Promise<ProjectSettingsReply>
  ): Promise<boolean> {
    const data = await this.run(request, (reply) => {
      this.#data = reply;
      this.drafts.rebase(reply);
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
