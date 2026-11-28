// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import { AvatarImage } from "../avatar/AvatarImage.ts";
import { agentAvatarPath } from "../http/routes.ts";
import type { MemberDirectory } from "../realm/MemberDirectory.ts";
import { SessionToken } from "../session/SessionToken.ts";
import type { AgentTokenRepository } from "../store/AgentTokenRepository.ts";
import type { AvatarRepository } from "../store/AvatarRepository.ts";
import {
  AGENT_TOKEN_DEFAULT_NAME,
  AGENT_TOKEN_NAME_MAX_LENGTH,
  agentTokenId,
  agentTokenNameSchema,
  agentTokenSubject,
  type AgentToken
} from "./AgentToken.ts";
import { AgentTokenNotFoundError } from "./errors/AgentTokenNotFoundError.ts";
import { AgentTokenRefusedError } from "./errors/AgentTokenRefusedError.ts";

export interface AgentTokenCreation {
  ownerId: string;
  /**
   * @default "Golem"
   */
  name?: string;
}

export interface CreatedAgentToken {
  token: AgentToken;
  /**
   * The credential. Only its digest is stored, so it cannot be read again.
   */
  value: string;
}

export class AgentTokens {
  #repository: AgentTokenRepository;
  #avatars: AvatarRepository;
  #members: MemberDirectory;

  constructor(
    repository: AgentTokenRepository,
    avatars: AvatarRepository,
    members: MemberDirectory
  ) {
    this.#repository = repository;
    this.#avatars = avatars;
    this.#members = members;
  }

  create(
    creation: AgentTokenCreation
  ): CreatedAgentToken {
    const name = agentTokenNameSchema.safeParse(
      creation.name ?? AGENT_TOKEN_DEFAULT_NAME
    );
    if (!name.success) {
      throw new AgentTokenRefusedError(
        `an agent token name has 1 to ${AGENT_TOKEN_NAME_MAX_LENGTH} characters`
      );
    }
    if (this.#members.member(creation.ownerId) === null) {
      throw new AgentTokenRefusedError("the owner is not a member");
    }

    const value = SessionToken.mint();
    const token: AgentToken = {
      id: randomUUID(),
      ownerId: creation.ownerId,
      name: name.data,
      createdAt: Date.now()
    };
    this.#repository.insert(this.#members.realmId, token, value);
    this.#members.record({
      type: "agent-token-created",
      actorId: token.ownerId,
      tokenId: token.id,
      name: token.name
    });

    return {
      token,
      value: value.value
    };
  }

  find(
    value: string
  ): AgentToken | null {
    const token = SessionToken.parse(value);

    return token === null ?
      null :
      this.#repository.live(this.#members.realmId, token);
  }

  bySubject(
    subject: string
  ): AgentToken | null {
    const tokenId = agentTokenId(subject);

    return tokenId === null ?
      null :
      this.#repository.byId(this.#members.realmId, tokenId);
  }

  ownedBy(
    ownerId: string
  ): AgentToken[] {
    return this.#repository.ownedBy(this.#members.realmId, ownerId);
  }

  revoke(
    ownerId: string,
    tokenId: string
  ): AgentToken {
    const token = this.#repository.revoke(
      this.#members.realmId,
      tokenId,
      ownerId,
      Date.now()
    );
    if (token === null) {
      throw new AgentTokenNotFoundError();
    }

    this.#members.revoke(agentTokenSubject(token.id));
    this.#members.record({
      type: "agent-token-revoked",
      actorId: ownerId,
      tokenId: token.id,
      name: token.name
    });

    return token;
  }

  disconnect(
    ownerId: string,
    tokenId: string
  ): AgentToken {
    const token = this.#owned(ownerId, tokenId);
    this.#members.disconnect(agentTokenSubject(token.id));

    return token;
  }

  async replaceAvatar(
    ownerId: string,
    tokenId: string,
    image: Uint8Array
  ): Promise<AgentToken> {
    const avatar = await AvatarImage.encode(image);
    const token = this.#owned(ownerId, tokenId);
    this.#avatars.replace(token.id, avatar);
    const replaced = {
      ...token,
      avatar: agentAvatarPath(token.id, avatar.hash)
    };
    this.#members.reprofile(agentTokenSubject(token.id), replaced.avatar);

    return replaced;
  }

  #owned(
    ownerId: string,
    tokenId: string
  ): AgentToken {
    const token = this.ownedBy(ownerId).find((owned) => owned.id === tokenId);
    if (token === undefined) {
      throw new AgentTokenNotFoundError();
    }

    return token;
  }
}
