// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  PROJECT_ROUTES,
  projectReplySchema,
  projectSectionsSchema,
  projectSettingsReplySchema,
  type AccessChange,
  type GameSection,
  type KindFilterSection,
  type KindOptions,
  type ProjectSections,
  type ProjectSettingsReply
} from "../../shared/api/project.ts";
import { ProjectRights } from "../../shared/ProjectRights.ts";

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

  replaceKinds(
    kinds: KindOptions
  ): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.replaceKinds,
      projectSettingsReplySchema,
      {
        body: kinds
      }
    );
  }

  replaceAccess(
    change: AccessChange
  ): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.replaceAccess,
      projectSettingsReplySchema,
      {
        body: change
      }
    );
  }

  sections(): Promise<ProjectSections> {
    return this.#endpoint.json(PROJECT_ROUTES.sections, projectSectionsSchema);
  }

  replaceKindFilter(
    kindFilter: KindFilterSection
  ): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.replaceKindFilter,
      projectSettingsReplySchema,
      {
        body: kindFilter
      }
    );
  }

  replaceGame(
    game: GameSection
  ): Promise<ProjectSettingsReply> {
    return this.#endpoint.json(
      PROJECT_ROUTES.replaceGame,
      projectSettingsReplySchema,
      {
        body: game
      }
    );
  }
}
