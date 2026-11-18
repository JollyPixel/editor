// Import Third-party Dependencies
import type { EditorConsole } from "@jolly-pixel/editor.host";

// CONSTANTS
export const GOLEM_COMMAND = "golem";

type Commands = EditorConsole["commands"];

export interface GolemConsoleHost {
  openGolemChat(
    message?: string
  ): void;
  stopGolems(): number;
}

export function golemConsole(
  commands: Commands,
  host: GolemConsoleHost
): void {
  commands.registerCommand(GOLEM_COMMAND, {
    description: "Open the golem chat, sending a message when one is given",
    args: [
      {
        name: "message",
        type: "string",
        rest: true
      }
    ],
    closeOnExecute: true,
    execute: ({ message }) => {
      host.openGolemChat(message);
    }
  });

  const namespace = commands.registerNamespace(GOLEM_COMMAND, {
    description: "Your agents in the golem chat"
  });
  namespace.registerCommand("stop", {
    description: "Stop the running turns of your bridged agents",
    args: [],
    execute: (_args, ctx) => {
      ctx.print(`Stopped ${host.stopGolems()} running agent(s).`);
    }
  });
}
