// Import Third-party Dependencies
import {
  ACCOUNTS_ROUTES,
  ACCOUNTS_URL_PATH,
  credentialsBody
} from "@jolly-pixel/accounts";
import {
  PROJECTS_ROUTES,
  PROJECTS_URL_PATH,
  createdProjectReplySchema,
  projectsReplySchema,
  type ProjectSummary,
  type ProjectsReply
} from "@jolly-pixel/server";

// Import Internal Dependencies
import { ApiEndpoint } from "../api/ApiEndpoint.ts";
import { ApiRequestError } from "../api/errors/ApiRequestError.ts";

// CONSTANTS
const kUnauthorized = 401;

export class ProjectsClient {
  static at(
    root: string | URL,
    fetch?: typeof globalThis.fetch
  ): ProjectsClient {
    return new ProjectsClient(
      new ApiEndpoint({
        url: new URL(`.${PROJECTS_URL_PATH}`, root),
        fetch
      }),
      new ApiEndpoint({
        url: new URL(`.${ACCOUNTS_URL_PATH}`, root),
        fetch
      })
    );
  }

  #projects: ApiEndpoint;
  #accounts: ApiEndpoint;

  constructor(
    projects: ApiEndpoint,
    accounts: ApiEndpoint
  ) {
    this.#projects = projects;
    this.#accounts = accounts;
  }

  async list(): Promise<ProjectsReply | null> {
    try {
      return await this.#projects.json(PROJECTS_ROUTES.list, projectsReplySchema);
    }
    catch (error) {
      if (error instanceof ApiRequestError && error.status === kUnauthorized) {
        return null;
      }

      throw error;
    }
  }

  async create(
    slug: string
  ): Promise<ProjectSummary> {
    const { project } = await this.#projects.json(
      PROJECTS_ROUTES.create,
      createdProjectReplySchema,
      {
        body: {
          slug
        }
      }
    );

    return project;
  }

  async signIn(
    username: string,
    password: string
  ): Promise<void> {
    await this.#accounts.send(ACCOUNTS_ROUTES.login, {
      body: await credentialsBody(username, password)
    });
  }

  async signOut(): Promise<void> {
    await this.#accounts.send(ACCOUNTS_ROUTES.logout);
  }
}
