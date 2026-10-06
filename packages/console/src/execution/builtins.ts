// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import { label } from "../registry/format.ts";
import type { ConsoleRegistry } from "../registry/types.ts";
import { helpText } from "./help.ts";
import type { RevertStack } from "./RevertStack.ts";

export function registerBuiltins(
  commands: CommandConsole,
  reverts: RevertStack
): void {
  commands.registerCommand("clear", {
    description: "Clear the scrollback",
    args: [],
    execute: () => commands.clearScrollback()
  });
  commands.registerCommand("help", {
    description: "List namespaces and commands, or describe one",
    args: [
      {
        name: "name",
        type: "string",
        autocomplete: () => helpTopics(commands.registry)
      }
    ],
    execute: ({ name }, ctx) => {
      const text = helpText(commands.registry, name);
      if (text === null) {
        ctx.error(`Nothing is registered as "${name}"`);
      }
      else {
        ctx.print(text);
      }
    }
  });
  commands.registerCommand("revert", {
    description: "Undo the last changes made from the console",
    args: [
      {
        name: "count",
        type: "number"
      }
    ],
    execute: ({ count = 1 }, ctx) => reverts.revert(count, ctx)
  });
}

function helpTopics(
  registry: ConsoleRegistry
): string[] {
  return [
    ...registry.namespaces(),
    ...registry.root.commands(),
    ...registry.root.variables()
  ]
    .map(label)
    .sort();
}
