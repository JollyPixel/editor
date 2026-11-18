// Import Third-party Dependencies
import * as acp from "@agentclientprotocol/sdk";

// CONSTANTS
const kSessionId = "fake-session";

export type FakeTurnScript = (turn: FakeTurn) => Promise<acp.StopReason>;

export class FakeTurn {
  readonly text: string;
  readonly cancelled: Promise<void>;

  #client: acp.AgentContext;

  constructor(
    text: string,
    client: acp.AgentContext,
    cancelled: Promise<void>
  ) {
    this.text = text;
    this.#client = client;
    this.cancelled = cancelled;
  }

  say(
    text: string
  ): Promise<void> {
    return this.#update({
      sessionUpdate: "agent_message_chunk",
      content: {
        type: "text",
        text
      }
    });
  }

  startTool(
    toolCall: acp.ToolCall
  ): Promise<void> {
    return this.#update({
      sessionUpdate: "tool_call",
      ...toolCall
    });
  }

  ask(
    request: Omit<acp.RequestPermissionRequest, "sessionId">
  ): Promise<acp.RequestPermissionResponse> {
    return this.#client.request(acp.methods.client.session.requestPermission, {
      sessionId: kSessionId,
      ...request
    });
  }

  #update(
    update: acp.SessionUpdate
  ): Promise<void> {
    return this.#client.notify(acp.methods.client.session.update, {
      sessionId: kSessionId,
      update
    });
  }
}

export class FakeAgent {
  readonly app: acp.AgentApp;
  readonly prompts: string[] = [];
  mcpServers: acp.McpServer[] = [];

  #script: FakeTurnScript;
  #cancel: (() => void) | null = null;

  constructor(
    script: FakeTurnScript
  ) {
    this.#script = script;
    this.app = acp.agent({ name: "fake-agent" })
      .onRequest(acp.methods.agent.initialize, () => {
        return {
          protocolVersion: acp.PROTOCOL_VERSION,
          agentCapabilities: {}
        };
      })
      .onRequest(acp.methods.agent.session.new, ({ params }) => {
        this.mcpServers = params.mcpServers;

        return {
          sessionId: kSessionId
        };
      })
      .onRequest(
        acp.methods.agent.session.prompt,
        ({ params, client }) => this.#prompt(params, client)
      )
      .onNotification(acp.methods.agent.session.cancel, () => {
        this.#cancel?.();
      });
  }

  stream(): acp.Stream {
    const toAgent = new TransformStream<acp.AnyMessage, acp.AnyMessage>();
    const toClient = new TransformStream<acp.AnyMessage, acp.AnyMessage>();
    this.app.connect({
      writable: toClient.writable,
      readable: toAgent.readable
    });

    return {
      writable: toAgent.writable,
      readable: toClient.readable
    };
  }

  async #prompt(
    params: acp.PromptRequest,
    client: acp.AgentContext
  ): Promise<acp.PromptResponse> {
    const text = params.prompt
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    this.prompts.push(text);
    const cancelled = Promise.withResolvers<void>();
    this.#cancel = cancelled.resolve;
    try {
      const stopReason = await this.#script(
        new FakeTurn(text, client, cancelled.promise)
      );

      return { stopReason };
    }
    finally {
      this.#cancel = null;
    }
  }
}
