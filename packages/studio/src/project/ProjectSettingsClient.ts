// Import Internal Dependencies
import {
  ApiEndpoint,
  type ApiEndpointOptions
} from "../api/ApiEndpoint.ts";
import {
  PROJECT_ROUTES,
  kindFilterSchema,
  projectReplySchema,
  projectSettingsReplySchema,
  type AccessChange,
  type KindFilterSection,
  type KindOptions,
  type ProjectSettingsReply
} from "../../shared/api/project.ts";
import { KindFilter } from "../../shared/KindFilter.ts";
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

  async kindFilter(): Promise<KindFilter> {
    return KindFilter.from(
      await this.#endpoint.json(PROJECT_ROUTES.kindFilter, kindFilterSchema)
    );
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
}
