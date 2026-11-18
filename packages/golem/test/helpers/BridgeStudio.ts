// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { Stream } from "@agentclientprotocol/sdk";
import {
  parseAgentBridgeState,
  type AgentBridgePermission,
  type AgentBridgeState,
  type CreatedAgentTokenReply
} from "@jolly-pixel/server";
import type { ServedBackend } from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { GolemBridge } from "#src/bridge/GolemBridge.ts";
import { ChatPeer } from "./ChatPeer.ts";
import {
  createAgentToken,
  registered
} from "./studio.ts";

// CONSTANTS
export const BRIDGED_MCP = {
  command: "node",
  args: ["jolly-golem.js", "mcp", "--bridged"]
};

export interface PendingPermission {
  bridgeClientId: string;
  request: AgentBridgePermission;
}

export class BridgeStudio implements Disposable {
  static async open(
    backend: ServedBackend
  ): Promise<BridgeStudio> {
    const alice = await registered(backend, "Alice");
    const bob = await registered(backend, "Bob");

    return new BridgeStudio(
      backend,
      await createAgentToken(backend, alice, "Builder"),
      await ChatPeer.join(backend, alice),
      await ChatPeer.join(backend, bob)
    );
  }

  readonly backend: ServedBackend;
  readonly builder: CreatedAgentTokenReply;
  readonly owner: ChatPeer;
  readonly other: ChatPeer;

  constructor(
    backend: ServedBackend,
    builder: CreatedAgentTokenReply,
    owner: ChatPeer,
    other: ChatPeer
  ) {
    this.backend = backend;
    this.builder = builder;
    this.owner = owner;
    this.other = other;
  }

  bridge(
    agent: Stream
  ): Promise<GolemBridge> {
    return GolemBridge.open({
      url: this.backend.url,
      token: this.builder.value,
      agent,
      mcp: BRIDGED_MCP
    });
  }

  async pendingPermission(): Promise<PendingPermission> {
    await this.owner.until(() => this.#state()?.permissions.length === 1);
    const bridge = this.#bridgePeer() ?? assert.fail("no bridge peer");

    return {
      bridgeClientId: bridge.clientId,
      request: bridge.state.permissions[0]
    };
  }

  untilIdle(): Promise<void> {
    return this.owner.until(() => {
      const state = this.#state();

      return state?.turn === "idle" && state.permissions.length === 0;
    });
  }

  lines(): string[][] {
    return this.owner.chat.messages.map(({ username, text }) => [username, text]);
  }

  [Symbol.dispose](): void {
    this.owner[Symbol.dispose]();
    this.other[Symbol.dispose]();
  }

  #state(): AgentBridgeState | null {
    return this.#bridgePeer()?.state ?? null;
  }

  #bridgePeer(): { clientId: string; state: AgentBridgeState; } | null {
    for (const peer of this.owner.chat.room.peers.values()) {
      const state = parseAgentBridgeState(peer.presence);
      if (state !== null) {
        return {
          clientId: peer.clientId,
          state
        };
      }
    }

    return null;
  }
}

export function optionNamed(
  request: AgentBridgePermission,
  name: string
): string {
  const option = request.options.find((candidate) => candidate.name === name);

  return option?.optionId ?? assert.fail(`no ${name} option`);
}
