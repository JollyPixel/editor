// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import type { Accounts } from "@jolly-pixel/accounts/node";
import { DEFAULT_ARCHIVE_MAX_BYTES } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { sessionAccount } from "../../http/node/authentication.ts";
import {
  BINARY_BODY_SCHEMA,
  binaryUpload
} from "../../http/node/binaryUpload.ts";
import {
  PROJECTS_ROUTES,
  projectRefSchema,
  type ProjectRef,
  type ProjectSummaryReply,
  type ProjectsReply
} from "../api.ts";
import type { ProjectIndex } from "./ProjectIndex.ts";
import { requireServerOwner } from "./requireServerOwner.ts";

// CONSTANTS
const kNoContent = 204;

export interface ProjectsRoutesOptions {
  accounts: Accounts;
  index: ProjectIndex;
}

interface CreateProjectRoute {
  Body: ProjectRef;
}

interface RenameProjectRoute {
  Params: ProjectRef;
  Body: ProjectRef;
}

interface RemoveProjectRoute {
  Params: ProjectRef;
}

interface ImportProjectRoute {
  Params: ProjectRef;
  Body: Uint8Array;
}

export async function projectsRoutes(
  app: FastifyInstance,
  options: ProjectsRoutesOptions
): Promise<void> {
  const { accounts, index } = options;
  const {
    list,
    create,
    rename,
    remove,
    import: importRoute
  } = PROJECTS_ROUTES;

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
      body: projectRefSchema
    },
    handler: async(request, reply) => reply.code(201).send({
      project: await index.create(
        sessionAccount(accounts, request),
        request.body.slug
      )
    } satisfies ProjectSummaryReply)
  });
  app.route<RenameProjectRoute>({
    method: rename.method,
    url: rename.path,
    schema: {
      params: projectRefSchema,
      body: projectRefSchema
    },
    handler: async(request): Promise<ProjectSummaryReply> => {
      return {
        project: await index.rename(
          sessionAccount(accounts, request),
          request.params.slug,
          request.body.slug
        )
      };
    }
  });
  app.route<RemoveProjectRoute>({
    method: remove.method,
    url: remove.path,
    schema: {
      params: projectRefSchema
    },
    handler: async(request, reply) => {
      await index.remove(
        sessionAccount(accounts, request),
        request.params.slug
      );

      return reply.code(kNoContent).send();
    }
  });
  await binaryUpload(app, (upload) => {
    upload.route<ImportProjectRoute>({
      method: importRoute.method,
      url: importRoute.path,
      bodyLimit: DEFAULT_ARCHIVE_MAX_BYTES,
      schema: {
        params: projectRefSchema,
        body: BINARY_BODY_SCHEMA
      },
      preParsing: async(request, _reply, payload) => {
        requireServerOwner(sessionAccount(accounts, request), "imports");

        return payload;
      },
      handler: async(request, reply) => reply.code(201).send({
        project: await index.import(
          sessionAccount(accounts, request),
          request.params.slug,
          request.body
        )
      } satisfies ProjectSummaryReply)
    });
  });
}
