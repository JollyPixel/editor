// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";
import type {
  AccessChange,
  KindOptions,
  ProjectSettingsReply
} from "../../shared/api/project.ts";
import type { ProjectRights } from "../../shared/ProjectRights.ts";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replaceKinds" | "replaceAccess"
>;

export class StudioProjectSettings extends RemoteState {
  readonly rights: ProjectRights;

  #client: ProjectSettingsSource;
  #data: ProjectSettingsReply | null = null;

  constructor(
    client: ProjectSettingsSource,
    rights: ProjectRights
  ) {
    super();
    this.#client = client;
    this.rights = rights;
  }

  get data(): ProjectSettingsReply | null {
    return this.#data;
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

  async #replace(
    request: () => Promise<ProjectSettingsReply>
  ): Promise<boolean> {
    const data = await this.run(request, (reply) => {
      this.#data = reply;
    });

    return data !== null;
  }
}
