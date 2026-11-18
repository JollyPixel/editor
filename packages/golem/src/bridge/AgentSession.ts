// Import Third-party Dependencies
import * as acp from "@agentclientprotocol/sdk";

export interface AgentSessionHandler {
  update(
    update: acp.SessionUpdate
  ): void;
  requestPermission(
    request: acp.RequestPermissionRequest,
    signal: AbortSignal
  ): Promise<acp.RequestPermissionResponse>;
}

export interface AgentSessionOptions {
  cwd: string;
  mcpServers: acp.McpServer[];
}

export class AgentSession {
  static async start(
    agent: acp.Stream,
    handler: AgentSessionHandler,
    options: AgentSessionOptions
  ): Promise<AgentSession> {
    const connection = acp.client({ name: "jolly-golem" })
      .onRequest(
        acp.methods.client.session.requestPermission,
        ({ params, signal }) => handler.requestPermission(params, signal)
      )
      .onNotification(
        acp.methods.client.session.update,
        ({ params }) => handler.update(params.update)
      )
      .connect(agent);
    try {
      await connection.agent.request(acp.methods.agent.initialize, {
        protocolVersion: acp.PROTOCOL_VERSION,
        clientCapabilities: {}
      });
      const { sessionId } = await connection.agent.request(
        acp.methods.agent.session.new,
        {
          cwd: options.cwd,
          mcpServers: options.mcpServers
        }
      );

      return new AgentSession(connection, sessionId);
    }
    catch (error) {
      connection.close();

      throw error;
    }
  }

  readonly closed: Promise<void>;

  #connection: acp.ClientConnection;
  #sessionId: string;

  constructor(
    connection: acp.ClientConnection,
    sessionId: string
  ) {
    this.#connection = connection;
    this.#sessionId = sessionId;
    this.closed = connection.closed;
  }

  async prompt(
    text: string
  ): Promise<void> {
    await this.#connection.agent.request(acp.methods.agent.session.prompt, {
      sessionId: this.#sessionId,
      prompt: [
        {
          type: "text",
          text
        }
      ]
    });
  }

  cancel(): void {
    this.#connection.agent.notify(acp.methods.agent.session.cancel, {
      sessionId: this.#sessionId
    }).catch(() => undefined);
  }

  close(): void {
    this.#connection.close();
  }
}
