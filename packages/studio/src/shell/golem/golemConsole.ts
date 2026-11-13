// Import Third-party Dependencies
import type { EditorConsole } from "@jolly-pixel/editor.host";

// CONSTANTS
export const GOLEM_COMMAND = "golem";

type Commands = EditorConsole["commands"];

export interface GolemChatOpener {
  openGolemChat(
    message?: string
  ): void;
}

export function golemConsole(
  commands: Commands,
  opener: GolemChatOpener
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
      opener.openGolemChat(message);
    }
  });
}
