// Import Node.js Dependencies
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  type CallToolResult
} from "@modelcontextprotocol/server";

// Import Internal Dependencies
import { GolemMcpServer } from "#src/mcp/GolemMcpServer.ts";
import type { GolemConnectOptions } from "#src/peer/GolemConnectOptions.ts";

export class McpAgent implements AsyncDisposable {
  static async connect(
    options: GolemConnectOptions
  ): Promise<McpAgent> {
    const server = new GolemMcpServer(options);
    const client = new Client({
      name: "golem-test",
      version: "0.0.0"
    });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    await client.connect(clientSide);

    return new McpAgent(client, server);
  }

  readonly client: Client;

  #server: GolemMcpServer;

  constructor(
    client: Client,
    server: GolemMcpServer
  ) {
    this.client = client;
    this.#server = server;
  }

  async call<T = unknown>(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<T> {
    const result = await this.#callTool(name, args);
    assert.ok(!result.isError, `${name} failed: ${resultText(result)}`);

    return JSON.parse(resultText(result));
  }

  async error(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<string> {
    const result = await this.#callTool(name, args);
    assert.ok(result.isError, `${name} succeeded: ${resultText(result)}`);

    return resultText(result);
  }

  async read(
    uri: string
  ): Promise<string> {
    const { contents } = await this.client.readResource({ uri });
    const [content] = contents;
    assert.ok(content !== undefined && "text" in content);

    return content.text;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.client.close();
    await this.#server.close();
  }

  async #callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult> {
    const result = await this.client.callTool({
      name,
      arguments: args
    });

    return result as CallToolResult;
  }
}

function resultText(
  result: CallToolResult
): string {
  const text = result.content.find((content) => content.type === "text");
  assert.ok(text?.type === "text", "the result has no text content");

  return text.text;
}
