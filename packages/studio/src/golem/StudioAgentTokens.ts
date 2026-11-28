// Import Third-party Dependencies
import type { AgentToken } from "@jolly-pixel/accounts";
import type { CreatedAgentTokenReply } from "@jolly-pixel/server";

// Import Internal Dependencies
import { RemoteState } from "../api/RemoteState.ts";
import type { AgentTokensClient } from "./AgentTokensClient.ts";

export type AgentTokensSource = Pick<
  AgentTokensClient,
  "list" | "create" | "revoke" | "disconnect" | "replaceAvatar"
>;

export class StudioAgentTokens extends RemoteState {
  #client: AgentTokensSource;
  #tokens: readonly AgentToken[] = [];

  constructor(
    client: AgentTokensSource
  ) {
    super();
    this.#client = client;
  }

  get tokens(): readonly AgentToken[] {
    return this.#tokens;
  }

  async load(): Promise<void> {
    await this.latest(() => this.#client.list(), ({ tokens }) => {
      this.#tokens = tokens;
    });
  }

  create(
    name?: string
  ): Promise<CreatedAgentTokenReply | null> {
    return this.run(() => this.#client.create(name), ({ token }) => {
      this.#tokens = [...this.#tokens, token];
    });
  }

  async revoke(
    tokenId: string
  ): Promise<void> {
    await this.run(() => this.#client.revoke(tokenId), () => {
      this.#tokens = this.#tokens.filter((token) => token.id !== tokenId);
    });
  }

  disconnect(
    tokenId: string
  ): Promise<void> {
    return this.#client.disconnect(tokenId);
  }

  async replaceAvatar(
    tokenId: string,
    image: Blob
  ): Promise<void> {
    await this.run(
      () => this.#client.replaceAvatar(tokenId, image),
      ({ token }) => {
        this.#tokens = this.#tokens.map(
          (known) => (known.id === token.id ? token : known)
        );
      }
    );
  }
}
