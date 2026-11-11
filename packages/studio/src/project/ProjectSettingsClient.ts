// Import Third-party Dependencies
import {
  PROJECT_ROUTES,
  projectReplySchema,
  projectSectionsSchema,
  projectSettingsReplySchema,
  type ProjectSections,
  type ProjectSettingsReply,
  type SettingsSectionBody,
  type SettingsSectionName,
  ProjectRights
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";

export class ProjectSettingsClient {
  #endpoint: ApiEndpoint;

  constructor(
    options: ApiEndpointOptions
  ) {
    this.#endpoint = new ApiEndpoint(options);
  }

  async rights(): Promise<ProjectRights> {
    return new ProjectRights(
      await this.#endpoint.json(PROJECT_ROUTES.rights, projectReplySchema)
    );
  }

  read(): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.settings,
      projectSettingsReplySchema
    );
  }

  sections(): Promise<ProjectSections> {
    return this.#endpoint.json(PROJECT_ROUTES.sections, projectSectionsSchema);
  }

  replace<TName extends SettingsSectionName>(
    section: TName,
    body: SettingsSectionBody<TName>
  ): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.replaceSection,
      projectSettingsReplySchema,
      {
        params: {
          section
        },
        body
      }
    );
  }
}
