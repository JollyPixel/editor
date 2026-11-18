// Import Node.js Dependencies
import {
  spawn,
  type ChildProcessByStdio
} from "node:child_process";
import { once } from "node:events";
import {
  Readable,
  Writable
} from "node:stream";

// Import Third-party Dependencies
import * as acp from "@agentclientprotocol/sdk";

// CONSTANTS
export const AGENT_COMMANDS: Readonly<Record<string, string>> = {
  claude: "npx -y @agentclientprotocol/claude-agent-acp@0.100.0",
  codex: "npx -y @agentclientprotocol/codex-acp@2.5.0"
};
const kExitTimeoutMs = 2_000;

export class AgentProcess implements AsyncDisposable {
  static spawn(
    agent: string,
    cwd: string
  ): AgentProcess {
    const child = spawn(AGENT_COMMANDS[agent] ?? agent, {
      cwd,
      shell: true,
      stdio: ["pipe", "pipe", "inherit"]
    });

    return new AgentProcess(child);
  }

  readonly stream: acp.Stream;
  readonly exited: Promise<void>;

  #child: ChildProcessByStdio<Writable, Readable, null>;

  constructor(
    child: ChildProcessByStdio<Writable, Readable, null>
  ) {
    this.#child = child;
    this.stream = acp.ndJsonStream(
      Writable.toWeb(child.stdin),
      Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>
    );
    this.exited = new Promise((resolve, reject) => {
      child.once("exit", () => resolve());
      child.once("error", reject);
    });
  }

  async close(): Promise<void> {
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) {
      return;
    }

    const exited = once(this.#child, "exit");
    this.#child.stdin.end();
    const timer = setTimeout(() => this.#child.kill(), kExitTimeoutMs);
    try {
      await exited;
    }
    finally {
      clearTimeout(timer);
    }
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.close();
  }
}
