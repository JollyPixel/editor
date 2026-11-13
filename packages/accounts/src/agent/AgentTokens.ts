// Import Node.js Dependencies
import { randomUUID } from "node:crypto";

// Import Internal Dependencies
import type { AccountDirectory } from "../AccountDirectory.ts";
import { SessionToken } from "../session/SessionToken.ts";
import type { AgentTokenRepository } from "../store/AgentTokenRepository.ts";
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
  #directory: AccountDirectory;

  constructor(
    repository: AgentTokenRepository,
    directory: AccountDirectory
  ) {
    this.#repository = repository;
    this.#directory = directory;
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
    if (this.#directory.account(creation.ownerId) === null) {
      throw new AgentTokenRefusedError("the owner has no account");
    }

    const value = SessionToken.mint();
    const token: AgentToken = {
      id: randomUUID(),
      ownerId: creation.ownerId,
      name: name.data,
      createdAt: Date.now()
    };
    this.#repository.insert(token, value);
    this.#directory.record({
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

    return token === null ? null : this.#repository.live(token);
  }

  bySubject(
    subject: string
  ): AgentToken | null {
    const tokenId = agentTokenId(subject);

    return tokenId === null ? null : this.#repository.byId(tokenId);
  }

  ownedBy(
    ownerId: string
  ): AgentToken[] {
    return this.#repository.ownedBy(ownerId);
  }

  revoke(
    ownerId: string,
    tokenId: string
  ): AgentToken {
    const token = this.#repository.revoke(tokenId, ownerId, Date.now());
    if (token === null) {
      throw new AgentTokenNotFoundError();
    }

    this.#directory.revoke(agentTokenSubject(token.id));
    this.#directory.record({
      type: "agent-token-revoked",
      actorId: ownerId,
      tokenId: token.id,
      name: token.name
    });

    return token;
  }
}
