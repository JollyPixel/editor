// Import Third-party Dependencies
import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionUpdate
} from "@agentclientprotocol/sdk";
import type { AgentBridgeState } from "@jolly-pixel/server";
import type { AgentChatClient } from "@jolly-pixel/server/client";

// Import Internal Dependencies
import type { AgentSessionHandler } from "./AgentSession.ts";
import {
  BridgePermissions,
  clipBridgeTitle
} from "./BridgePermissions.ts";
import { GolemToolCalls } from "./GolemToolCalls.ts";
import { ReplyBuffer } from "./ReplyBuffer.ts";

export class ChatRelay implements AgentSessionHandler {
  #chat: AgentChatClient;
  #reply = new ReplyBuffer();
  #toolCalls = new GolemToolCalls();
  #permissions = new BridgePermissions(() => this.#publish());
  #turn: AgentBridgeState["turn"] = "idle";
  #tool: string | null = null;
  #saying: Promise<void> = Promise.resolve();
  #closed = false;

  constructor(
    chat: AgentChatClient
  ) {
    this.#chat = chat;
  }

  async turn(
    prompt: () => Promise<void>
  ): Promise<void> {
    this.#turn = "running";
    this.#publish();
    try {
      await prompt();
    }
    catch (error) {
      this.#reply.append(`\n\nThe agent failed: ${errorMessage(error)}`);
    }
    finally {
      this.#flush();
      this.#tool = null;
      this.#toolCalls.clear();
    }
  }

  idle(): void {
    this.#turn = "idle";
    this.#publish();
  }

  answer(
    requestId: string,
    optionId: string
  ): void {
    this.#permissions.answer(requestId, optionId);
  }

  cancelPermissions(): void {
    this.#permissions.cancelAll();
  }

  update(
    update: SessionUpdate
  ): void {
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        if (update.content.type === "text") {
          this.#reply.append(update.content.text);
        }
        break;
      case "tool_call":
        this.#flush();
        this.#toolCalls.record(update);
        this.#showTool(update.title);
        break;
      case "tool_call_update":
        this.#toolCalls.record(update);
        if (typeof update.title === "string") {
          this.#showTool(update.title);
        }
        break;
      default:
        break;
    }
  }

  requestPermission(
    request: RequestPermissionRequest,
    signal: AbortSignal
  ): Promise<RequestPermissionResponse> {
    const allow = this.#toolCalls.isGolem(request) ?
      request.options.find((option) => option.kind === "allow_once") :
      undefined;
    if (allow !== undefined) {
      return Promise.resolve({
        outcome: {
          outcome: "selected",
          optionId: allow.optionId
        }
      });
    }

    this.#flush();

    return this.#permissions.ask(request, signal);
  }

  async close(): Promise<void> {
    this.#closed = true;
    this.#permissions.cancelAll();
    await this.#saying;
  }

  #showTool(
    title: string
  ): void {
    this.#tool = clipBridgeTitle(title);
    this.#publish();
  }

  #flush(): void {
    const replies = this.#reply.take();
    if (this.#closed) {
      return;
    }

    for (const text of replies) {
      this.#saying = this.#saying
        .then(() => this.#chat.say(text))
        .then(() => undefined, (error: unknown) => {
          console.error(
            `The bridge could not post a reply: ${errorMessage(error)}`
          );
        });
    }
  }

  #publish(): void {
    if (this.#closed) {
      return;
    }

    this.#chat.publishBridge({
      turn: this.#turn,
      ...(this.#tool === null ? {} : { tool: this.#tool }),
      permissions: this.#permissions.pending
    });
  }
}

function errorMessage(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}
