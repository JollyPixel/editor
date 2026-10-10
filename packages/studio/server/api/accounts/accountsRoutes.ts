// Import Third-party Dependencies
import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import * as z from "zod";
import {
  ACCOUNTS_ROUTES,
  AVATAR_MAX_BYTES,
  AccountsError,
  credentialsBodySchema,
  registrationBodySchema
} from "@jolly-pixel/accounts";
import type { Accounts } from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  AccountsController,
  type AvatarRoute,
  type LoginRoute,
  type RegisterRoute,
  type ReplaceAvatarRoute
} from "./AccountsController.ts";
import { ApiError } from "../errors/ApiError.ts";

// CONSTANTS
const kAvatarBodySchema = z.instanceof(Uint8Array);
const kDefaultRequestsPerMinute = 300;

export interface AccountsRoutesOptions {
  accounts: Accounts;
  requestsPerMinute?: number;
}

export async function accountsRoutes(
  app: FastifyInstance,
  options: AccountsRoutesOptions
): Promise<void> {
  const controller = new AccountsController(options.accounts);
  const {
    register,
    login,
    logout,
    me,
    replaceAvatar,
    avatar
  } = ACCOUNTS_ROUTES;

  app.decorateRequest("account", null);
  app.setValidatorCompiler<z.ZodType>(({ schema }) => (data) => {
    const parsed = schema.safeParse(data);

    return parsed.success ?
      { value: parsed.data } :
      { error: parsed.error };
  });
  app.setErrorHandler((error) => {
    throw error instanceof AccountsError ? controller.failure(error) : error;
  });
  await app.register(rateLimit, {
    max: options.requestsPerMinute ?? kDefaultRequestsPerMinute,
    timeWindow: 60_000,
    errorResponseBuilder: (_request, context) => new ApiError(
      context.statusCode,
      "throttled",
      "too many requests",
      {
        "retry-after": String(Math.ceil(context.ttl / 1_000))
      }
    )
  });

  app.route<RegisterRoute>({
    method: register.method,
    url: register.path,
    schema: {
      body: registrationBodySchema
    },
    handler: (request, reply) => controller.register(request, reply)
  });
  app.route<LoginRoute>({
    method: login.method,
    url: login.path,
    schema: {
      body: credentialsBodySchema
    },
    handler: (request, reply) => controller.login(request, reply)
  });
  app.route({
    method: logout.method,
    url: logout.path,
    handler: (request, reply) => controller.logout(request, reply)
  });
  app.route({
    method: me.method,
    url: me.path,
    preParsing: (request, reply, payload) => controller.authenticate(
      request,
      reply,
      payload
    ),
    handler: (request) => controller.me(request)
  });
  app.route<AvatarRoute>({
    method: avatar.method,
    url: avatar.path,
    handler: (request, reply) => controller.avatar(request, reply)
  });

  await app.register(async(avatarUpload) => {
    avatarUpload.addContentTypeParser(
      "*",
      {
        parseAs: "buffer"
      },
      (_request, body, done) => done(null, body)
    );
    avatarUpload.route<ReplaceAvatarRoute>({
      method: replaceAvatar.method,
      url: replaceAvatar.path,
      bodyLimit: AVATAR_MAX_BYTES,
      schema: {
        body: kAvatarBodySchema
      },
      preParsing: (request, reply, payload) => controller.authenticate(
        request,
        reply,
        payload
      ),
      handler: (request) => controller.replaceAvatar(request)
    });
  });
}
