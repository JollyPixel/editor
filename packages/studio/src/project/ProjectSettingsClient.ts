// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  ACCESS_SECTION,
  KINDS_SECTION,
  PROJECT_SETTINGS_PATH,
  projectReplySchema,
  projectSettingsReplySchema,
  type AccessSection,
  type KindOptions,
  type ProjectReply,
  type ProjectSettingsReply,
  type SettingsSectionName
} from "./routes.ts";

export class ProjectSettingsClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async rights(): Promise<ProjectReply> {
    const response = await this.#endpoint.send("");

    return projectReplySchema.parse(await response.json());
  }

  async read(): Promise<ProjectSettingsReply> {
    const response = await this.#endpoint.send(PROJECT_SETTINGS_PATH);

    return projectSettingsReplySchema.parse(await response.json());
  }

  replaceKinds(
    kinds: KindOptions
  ): Promise<ProjectSettingsReply> {
    return this.#replace(KINDS_SECTION, kinds);
  }

  replaceAccess(
    access: AccessSection
  ): Promise<ProjectSettingsReply> {
    return this.#replace(ACCESS_SECTION, access);
  }

  async #replace(
    section: SettingsSectionName,
    value: unknown
  ): Promise<ProjectSettingsReply> {
    const response = await this.#endpoint.send(
      `${PROJECT_SETTINGS_PATH}/${section}`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(value)
      }
    );

    return projectSettingsReplySchema.parse(await response.json());
  }
}
