// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import { sessionAccount } from "../../http/node/authentication.ts";
import {
  PROJECTS_ROUTES,
  createProjectBodySchema,
  type CreateProjectBody,
  type CreatedProjectReply,
  type ProjectsReply
} from "../api.ts";
import type { ProjectIndex } from "./ProjectIndex.ts";

export interface ProjectsRoutesOptions {
  accounts: Accounts;
  index: ProjectIndex;
}

interface CreateProjectRoute {
  Body: CreateProjectBody;
}

export async function projectsRoutes(
  app: FastifyInstance,
  options: ProjectsRoutesOptions
): Promise<void> {
  const { accounts, index } = options;
  const { list, create } = PROJECTS_ROUTES;

  app.route({
    method: list.method,
    url: list.path,
    handler: async(request): Promise<ProjectsReply> => {
      const account = sessionAccount(accounts, request);

      return {
        account,
        projects: await index.list(account)
      };
    }
  });
  app.route<CreateProjectRoute>({
    method: create.method,
    url: create.path,
    schema: {
      body: createProjectBodySchema
    },
    handler: async(request, reply) => reply.code(201).send({
      project: await index.create(
        sessionAccount(accounts, request),
        request.body.slug
      )
    } satisfies CreatedProjectReply)
  });
}
