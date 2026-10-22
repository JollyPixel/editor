// Import Internal Dependencies
import type { ProjectSettingsClient } from "./ProjectSettingsClient.ts";
import type {
  AccessChange,
  KindOptions,
  ProjectReply,
  ProjectSettingsReply
} from "./routes.ts";

// CONSTANTS
export const PROJECT_SETTINGS_CHANGE = "change";

export type ProjectSettingsSource = Pick<
  ProjectSettingsClient,
  "read" | "replaceKinds" | "replaceAccess"
>;

export class StudioProjectSettings extends EventTarget {
  readonly rights: ProjectReply;

  #client: ProjectSettingsSource;
  #data: ProjectSettingsReply | null = null;
  #error: string | null = null;

  constructor(
    client: ProjectSettingsSource,
    rights: ProjectReply
  ) {
    super();
    this.#client = client;
    this.rights = rights;
  }

  get data(): ProjectSettingsReply | null {
    return this.#data;
  }

  get error(): string | null {
    return this.#error;
  }

  get canEdit(): boolean {
    return this.rights.canEditSettings;
  }

  async load(): Promise<void> {
    await this.#run(() => this.#client.read());
  }

  replaceKinds(
    kinds: KindOptions
  ): Promise<boolean> {
    return this.#run(() => this.#client.replaceKinds(kinds));
  }

  replaceAccess(
    change: AccessChange
  ): Promise<boolean> {
    return this.#run(() => this.#client.replaceAccess(change));
  }

  async #run(
    action: () => Promise<ProjectSettingsReply>
  ): Promise<boolean> {
    try {
      this.#data = await action();
      this.#error = null;

      return true;
    }
    catch (error) {
      this.#error = error instanceof Error ? error.message : String(error);

      return false;
    }
    finally {
      this.dispatchEvent(new Event(PROJECT_SETTINGS_CHANGE));
    }
  }
}
