// Import Node.js Dependencies
import { randomUUID } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";

// Import Third-party Dependencies
import {
  GUEST_USERNAME,
  type AuthenticationProvider,
  type AuthenticationRequest,
  type PeerIdentity,
  type PeerMetadata,
  type PeerProfileMetadata
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AccountActivity } from "./AccountActivity.ts";
import type {
  Requester,
  SignIn
} from "./Accounts.ts";
import {
  GUEST_ROLE,
  type Member
} from "./account/Account.ts";
import {
  AGENT_TOKEN_VIA,
  agentTokenSubject,
  type AgentProfile,
  type AgentToken
} from "./agent/AgentToken.ts";
import { AgentTokens } from "./agent/AgentTokens.ts";
import type { AccountRoles } from "./auth/AccountRoles.ts";
import { parseCredentials } from "./auth/parseCredentials.ts";
import type {
  CredentialsBody,
  RegistrationBody
} from "./http/routes.schema.ts";
import type { JoinMode } from "./realm/JoinMode.ts";
import type { MemberDirectory } from "./realm/MemberDirectory.ts";
import { AccountsExtension } from "./room/AccountsExtension.ts";
import type { CookieSessions } from "./session/CookieSessions.ts";
import {
  SHARE_LINK_VIA,
  type ShareLink
} from "./share/ShareLink.ts";
import {
  ShareLinks,
  shareLinkSubject
} from "./share/ShareLinks.ts";
import type { AccountsDatabase } from "./store/AccountsDatabase.ts";

export interface AccountsRealmOptions {
  roles: AccountRoles;
  /**
   * @default "request"
   */
  join?: JoinMode;
  /**
   * Access requests allowed to wait at once.
   * @default 20
   */
  maxRequests?: number;
}

export interface MemberSignIn extends SignIn {
  account: Member;
}

export type SignInRegistration =
  | (MemberSignIn & {
    status: "active";
  })
  | {
    status: "pending";
  };

export interface AccountsRealmParts {
  members: MemberDirectory;
  sessions: CookieSessions;
  database: AccountsDatabase;
  closed: () => void;
}

export class AccountsRealm implements AuthenticationProvider, Disposable {
  readonly id: string;
  readonly extension: AccountsExtension;
  readonly shareLinks: ShareLinks;
  readonly agentTokens: AgentTokens;

  #members: MemberDirectory;
  #sessions: CookieSessions;
  #closed: () => void;

  constructor(
    parts: AccountsRealmParts
  ) {
    this.id = parts.members.realmId;
    this.#members = parts.members;
    this.#sessions = parts.sessions;
    this.#closed = parts.closed;
    this.extension = new AccountsExtension(parts.members);
    this.shareLinks = new ShareLinks(parts.database.shareLinks, parts.members);
    this.agentTokens = new AgentTokens(parts.database.agentTokens, parts.members);
  }

  get roles(): AccountRoles {
    return this.#members.roles;
  }

  get join(): JoinMode {
    return this.#members.join;
  }

  replaceRoles(
    roles: AccountRoles,
    renamed?: ReadonlyMap<string, string>
  ): void {
    this.#members.replaceRoles(roles, renamed);
  }

  replaceJoin(
    join: JoinMode
  ): void {
    this.#members.replaceJoin(join);
  }

  holders(
    role: string
  ): string[] {
    return this.#members.holders(role);
  }

  member(
    accountId: string
  ): Member | null {
    return this.#members.member(accountId);
  }

  async register(
    body: RegistrationBody,
    requester: Requester
  ): Promise<SignInRegistration> {
    const registration = await this.#members.register(
      {
        ...parseCredentials(body),
        options: {
          masterPassword: body.masterPassword
        }
      },
      requester.address
    );
    if (registration.status === "pending") {
      return registration;
    }

    return {
      status: "active",
      ...this.#signIn(registration.account, requester)
    };
  }

  async login(
    body: CredentialsBody,
    requester: Requester
  ): Promise<MemberSignIn> {
    const member = await this.#members.login(
      parseCredentials(body),
      requester.address
    );

    return this.#signIn(member, requester);
  }

  signedIn(
    headers: IncomingHttpHeaders
  ): Member | null {
    const accountId = this.#sessions.accountId(headers);

    return accountId === null ? null : this.#members.member(accountId);
  }

  authenticate(
    request: AuthenticationRequest
  ): PeerIdentity | null {
    const { credential } = request;
    if (credential !== undefined) {
      const link = this.shareLinks.find(credential);
      if (link !== null) {
        return toGuestIdentity(link);
      }

      return this.#agentIdentity(credential);
    }

    const member = this.signedIn(request.headers);
    if (member === null) {
      return null;
    }

    return {
      subject: member.id,
      role: member.role,
      profile: toPeerProfile(member)
    };
  }

  watchRevocations(
    listener: (subject: string) => void
  ): () => void {
    return this.#members.subscribe("revoked", listener);
  }

  watchDisconnections(
    listener: (subject: string) => void
  ): () => void {
    return this.#members.subscribe("disconnected", listener);
  }

  watchActivity(
    listener: (activity: AccountActivity) => void
  ): () => void {
    return this.#members.subscribe("activity", listener);
  }

  watchProfiles(
    listener: (accountId: string, profile: PeerMetadata) => void
  ): () => void {
    return this.#members.subscribe(
      "profile",
      (member) => listener(member.id, toPeerProfile(member))
    );
  }

  [Symbol.dispose](): void {
    this.shareLinks[Symbol.dispose]();
    this.extension.dispose();
    this.#members[Symbol.dispose]();
    this.#closed();
  }

  #agentIdentity(
    credential: string
  ): PeerIdentity | null {
    const token = this.agentTokens.find(credential);
    if (token === null) {
      return null;
    }
    const owner = this.#members.member(token.ownerId);

    return owner === null ? null : toAgentIdentity(token, owner);
  }

  #signIn(
    member: Member,
    requester: Requester
  ): MemberSignIn {
    return {
      account: member,
      cookie: this.#sessions.open(member.id, requester.secure)
    };
  }
}

function toGuestIdentity(
  link: ShareLink
): PeerIdentity {
  return {
    subject: shareLinkSubject(link.id),
    role: GUEST_ROLE,
    profile: {
      username: GUEST_USERNAME,
      peerId: randomUUID(),
      avatar: null,
      via: SHARE_LINK_VIA
    } satisfies PeerProfileMetadata
  };
}

function toAgentIdentity(
  token: AgentToken,
  owner: Member
): PeerIdentity {
  return {
    subject: agentTokenSubject(token.id),
    role: owner.role,
    profile: {
      username: token.name,
      peerId: token.id,
      avatar: null,
      via: AGENT_TOKEN_VIA,
      ownerId: owner.id
    } satisfies PeerProfileMetadata & AgentProfile
  };
}

function toPeerProfile(
  member: Member
): PeerProfileMetadata {
  return {
    username: member.username,
    peerId: member.id,
    avatar: member.avatar ?? null
  };
}
