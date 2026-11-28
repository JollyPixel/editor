// Import Third-party Dependencies
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest
} from "fastify";
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
  Requester,
  StoredAvatar
} from "@jolly-pixel/accounts/node";

// Import Internal Dependencies
import {
  authenticate,
  sessionAccount,
  signedInAccount
} from "../../http/node/authentication.ts";
import {
  BINARY_BODY_SCHEMA,
  binaryUpload
} from "../../http/node/binaryUpload.ts";
import { ApiError } from "../../http/node/errors/ApiError.ts";
import type { RequestScoped } from "../../http/node/RequestScoped.ts";

// CONSTANTS
const kAvatarContentType = "image/webp";
const kImmutable = "public, max-age=31536000, immutable";
const kRevalidate = "no-cache";

export interface AccountsRoutesOptions {
  accounts: Accounts;
  realm: RequestScoped<AccountsRealm>;
}

export interface ServerAccountsRoutesOptions {
  accounts: Accounts;
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

interface AvatarVersion {
  [AVATAR_VERSION_PARAM]?: string | string[];
}

interface AvatarRoute {
  Params: {
    accountId: string;
  };
  Querystring: AvatarVersion;
}

interface AgentAvatarRoute {
  Params: {
    tokenId: string;
  };
  Querystring: AvatarVersion;
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
    join,
    logout,
    me,
    replaceAvatar
  } = ACCOUNTS_ROUTES;

  app.route<RegisterRoute>({
    method: register.method,
    url: register.path,
    schema: {
      body: registrationBodySchema
    },
    handler: async(request, reply) => {
      const registration = await realm(request).register(
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
    handler: async(request, reply): Promise<AccountReply> => {
      const { account, cookie } = await accounts.login(
        request.body,
        requester(request)
      );
      reply.header("set-cookie", cookie);

      return {
        account: realm(request).admit(account.id)
      };
    }
  });
  app.route({
    method: join.method,
    url: join.path,
    handler: (request, reply) => {
      const joined = realm(request).join(
        sessionAccount(accounts, request).id
      );

      return joined.status === "pending" ?
        reply.code(202).send() :
        reply.code(201).send({
          account: joined.account
        } satisfies AccountReply);
    }
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
    handler: (request): AccountReply => {
      return {
        account: realm(request).admit(sessionAccount(accounts, request).id)
      };
    }
  });
  avatarRoute(app, accounts);

  await binaryUpload(app, (upload) => {
    upload.route<ReplaceAvatarRoute>({
      method: replaceAvatar.method,
      url: replaceAvatar.path,
      bodyLimit: AVATAR_MAX_BYTES,
      schema: {
        body: BINARY_BODY_SCHEMA
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

export async function serverAccountsRoutes(
  app: FastifyInstance,
  options: ServerAccountsRoutesOptions
): Promise<void> {
  const { accounts } = options;
  const { login, logout } = ACCOUNTS_ROUTES;

  app.route<LoginRoute>({
    method: login.method,
    url: login.path,
    schema: {
      body: credentialsBodySchema
    },
    handler: async(request, reply) => {
      const signIn = await accounts.login(request.body, requester(request));

      return reply
        .header("set-cookie", signIn.cookie)
        .send({
          account: signIn.account
        });
    }
  });
  app.route({
    method: logout.method,
    url: logout.path,
    handler: (request, reply) => reply
      .code(204)
      .header("set-cookie", accounts.signOut(requester(request)))
      .send()
  });
  avatarRoute(app, accounts);
}

function avatarRoute(
  app: FastifyInstance,
  accounts: Accounts
): void {
  const { avatar, agentAvatar } = ACCOUNTS_ROUTES;

  app.route<AvatarRoute>({
    method: avatar.method,
    url: avatar.path,
    handler: (request, reply) => {
      const stored = accounts.avatar(request.params.accountId);
      if (stored === null) {
        throw new ApiError(404, "not-found", "the account has no avatar");
      }

      return sendAvatar(reply, stored, request.query);
    }
  });
  app.route<AgentAvatarRoute>({
    method: agentAvatar.method,
    url: agentAvatar.path,
    handler: (request, reply) => {
      const stored = accounts.agentAvatar(request.params.tokenId);
      if (stored === null) {
        throw new ApiError(404, "not-found", "the agent has no avatar");
      }

      return sendAvatar(reply, stored, request.query);
    }
  });
}

function sendAvatar(
  reply: FastifyReply,
  stored: StoredAvatar,
  query: AvatarVersion
): FastifyReply {
  const version = query[AVATAR_VERSION_PARAM];

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
