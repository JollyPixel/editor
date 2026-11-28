// Import Node.js Dependencies
import { once } from "node:events";

// Import Internal Dependencies
import { AgentProcess } from "../bridge/AgentProcess.ts";
import { GolemBridge } from "../bridge/GolemBridge.ts";
import type { GolemConnectOptions } from "../peer/GolemConnectOptions.ts";

export interface RunBridgeOptions extends GolemConnectOptions {
  agent: string;
  cwd: string;
  script: string;
}

export async function runBridge(
  options: RunBridgeOptions
): Promise<void> {
  await using agent = AgentProcess.spawn(options.agent, options.cwd);
  await using bridge = await GolemBridge.open({
    url: options.url,
    token: options.token,
    agent: agent.stream,
    cwd: options.cwd,
    mcp: {
      command: process.execPath,
      args: [options.script, "mcp", "--chat", "bridged"]
    }
  });
  console.error(
    `The bridge runs ${options.agent} for its owner: ` +
    "write in the studio's golem chat. Ctrl+C stops it."
  );

  const interrupted = new AbortController();
  await Promise.race([
    bridge.closed,
    agent.exited,
    once(process, "SIGINT", { signal: interrupted.signal })
  ]).finally(() => interrupted.abort());
}
