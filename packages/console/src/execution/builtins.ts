// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import {
  ancestorAddresses,
  isWithin,
  relativeAddress
} from "../registry/address.ts";
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
  commands.registerCommand("cd", {
    description: "Enter a namespace; .. goes up, no name returns to the root",
    args: [
      {
        name: "namespace",
        type: "string",
        autocomplete: () => cdTargets(commands.scoped)
      }
    ],
    execute: ({ namespace = "" }) => {
      commands.enter(namespace);
    }
  });
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
      const text = helpText(commands.scoped, name);
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
        autocomplete: () => scriptScopes(commands.scoped)
      }
    ],
    execute: ({ namespace }) => {
      commands.editScript(namespace);
    }
  });
}

function cdTargets(
  registry: ConsoleRegistry
): string[] {
  const addresses = Array.from(
    registry.namespaces(),
    (namespace) => namespace.address
  );
  const targets = namespaceTargets(registry, addresses);

  return registry.scope.address === "" ? targets : ["..", ...targets];
}

function scriptScopes(
  registry: ConsoleRegistry
): string[] {
  const addresses = new Set<string>();
  for (const namespace of registry.namespaces()) {
    if (!namespace.variables().next().done) {
      addresses.add(namespace.address);
      for (const ancestor of ancestorAddresses(namespace.address)) {
        addresses.add(ancestor);
      }
    }
  }

  return namespaceTargets(registry, addresses);
}

function namespaceTargets(
  registry: ConsoleRegistry,
  addresses: Iterable<string>
): string[] {
  const scope = registry.scope.address;
  const relative: string[] = [];
  const absolute: string[] = [];
  for (const address of addresses) {
    if (scope !== "" && isWithin(address, scope)) {
      relative.push(relativeAddress(address, scope));
    }
    absolute.push(address);
  }

  return [
    ...new Set([
      ...relative.sort(compareText),
      ...absolute.sort(compareText)
    ])
  ];
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
