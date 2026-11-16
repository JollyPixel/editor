// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
import * as z from "zod";
import {
  ACCOUNTS_ROUTES,
  AVATAR_MAX_BYTES,
  AVATAR_VERSION_PARAM,
  credentialsBodySchema,
  registrationBodySchema,
  type AccountReply,
  type CredentialsBody,
  type RegistrationBody
} from "@jolly-pixel/accounts";
import type {
  Accounts,
  AccountsRealm,
  MemberSignIn,
  Requester
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  authenticate,
  signedInAccount
} from "../../http/node/authentication.ts";
import { ApiError } from "../../http/node/errors/ApiError.ts";

// CONSTANTS
const kAvatarBodySchema = z.instanceof(Uint8Array);
const kAvatarContentType = "image/webp";
const kImmutable = "public, max-age=31536000, immutable";
const kRevalidate = "no-cache";

export interface AccountsRoutesOptions {
  accounts: Accounts;
  realm: AccountsRealm;
}

interface RegisterRoute {
  Body: RegistrationBody;
}

interface LoginRoute {
  Body: CredentialsBody;
}

interface ReplaceAvatarRoute {
  Body: Uint8Array;
}

interface AvatarRoute {
  Params: {
    accountId: string;
  };
  Querystring: {
    [AVATAR_VERSION_PARAM]?: string | string[];
  };
}

export async function accountsRoutes(
  app: FastifyInstance,
  options: AccountsRoutesOptions
): Promise<void> {
  const { accounts, realm } = options;
  const signedIn = authenticate(realm);
  const {
    register,
    login,
    logout,
    me,
    replaceAvatar,
    avatar
  } = ACCOUNTS_ROUTES;

  app.route<RegisterRoute>({
    method: register.method,
    url: register.path,
    schema: {
      body: registrationBodySchema
    },
    handler: async(request, reply) => {
      const registration = await realm.register(
        request.body,
        requester(request)
      );

      return registration.status === "pending" ?
        reply.code(202).send() :
        sendSignIn(reply.code(201), registration);
    }
  });
  app.route<LoginRoute>({
    method: login.method,
    url: login.path,
    schema: {
      body: credentialsBodySchema
    },
    handler: async(request, reply) => sendSignIn(
      reply,
      await realm.login(request.body, requester(request))
    )
  });
  app.route({
    method: logout.method,
    url: logout.path,
    handler: (request, reply) => reply
      .code(204)
      .header("set-cookie", accounts.signOut(requester(request)))
      .send()
  });
  app.route({
    method: me.method,
    url: me.path,
    preParsing: signedIn,
    handler: (request): AccountReply => {
      return {
        account: signedInAccount(request)
      };
    }
  });
  app.route<AvatarRoute>({
    method: avatar.method,
    url: avatar.path,
    handler: (request, reply) => {
      const stored = accounts.avatar(request.params.accountId);
      if (stored === null) {
        throw new ApiError(404, "not-found", "the account has no avatar");
      }
      const version = request.query[AVATAR_VERSION_PARAM];

      return reply
        .header("content-type", kAvatarContentType)
        .header(
          "cache-control",
          version === stored.hash ? kImmutable : kRevalidate
        )
        .header("cross-origin-resource-policy", "same-origin")
        .header("x-content-type-options", "nosniff")
        .send(stored.bytes);
    }
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
      preParsing: signedIn,
      handler: async(request): Promise<AccountReply> => {
        const { id, role } = signedInAccount(request);

        return {
          account: {
            ...await accounts.replaceAvatar(id, request.body),
            role
          }
        };
      }
    });
  });
}

function requester(
  request: FastifyRequest
): Requester {
  return {
    address: request.ip,
    secure: request.protocol === "https",
    headers: request.headers
  };
}

function sendSignIn(
  reply: FastifyReply,
  signIn: MemberSignIn
): FastifyReply {
  return reply
    .header("set-cookie", signIn.cookie)
    .send({
      account: signIn.account
    } satisfies AccountReply);
}
