// CONSTANTS
const kLauncher = "<checkout>/packages/golem/dist/bin/jolly-golem.js";

export interface AgentSetupLineOptions {
  /**
   * The studio the agent connects to.
   */
  studioUrl: string;
  token: string;
}

export function agentSetupLine(
  options: AgentSetupLineOptions
): string {
  return [
    "claude mcp add jollypixel",
    `--env JOLLY_GOLEM_TOKEN=${options.token}`,
    `-- node ${kLauncher} mcp`,
    `--url ${options.studioUrl}`
  ].join(" ");
}
