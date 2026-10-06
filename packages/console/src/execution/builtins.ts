// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import {
  compareText,
  label
} from "../registry/format.ts";
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
  commands.registerCommand("script", {
    description: "Edit variables together as a script, then save or cancel",
    args: [
      {
        name: "namespace",
        type: "string",
        autocomplete: () => scriptScopes(commands.registry)
      }
    ],
    execute: ({ namespace }) => {
      commands.editScript(namespace);
    }
  });
}

function scriptScopes(
  registry: ConsoleRegistry
): string[] {
  return Array.from(registry.namespaces())
    .filter((namespace) => !namespace.variables().next().done)
    .map((namespace) => namespace.name)
    .sort(compareText);
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
