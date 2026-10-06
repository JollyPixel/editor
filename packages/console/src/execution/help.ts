// Import Internal Dependencies
import {
  byName,
  signature,
  variableSignature
} from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredNamespace
} from "../registry/types.ts";

export function helpText(
  registry: ConsoleRegistry,
  name?: string
): string | null {
  if (name === undefined || name === "") {
    return overview(registry);
  }

  if (name.startsWith("/")) {
    const command = registry.resolveCommand(name.slice(1));

    return command === undefined ? null : describeCommand(command);
  }

  if (!name.includes(".")) {
    const namespace = registry.namespace(name);
    if (namespace !== undefined) {
      return describeNamespace(namespace);
    }
  }

  const command = registry.resolveCommand(name);
  if (command !== undefined) {
    return describeCommand(command);
  }
  const variable = registry.resolveVariable(name);

  return variable === undefined ?
    null :
    table([[variableSignature(variable), variable.description]]);
}

function overview(
  registry: ConsoleRegistry
): string {
  const namespaces = [...registry.namespaces()]
    .sort(byName)
    .map((namespace) => [namespace.name, namespace.description]);

  return [
    section("Namespaces", namespaces),
    namespaceMembers(registry.root)
  ].filter((part) => part !== "").join("\n");
}

function describeNamespace(
  namespace: RegisteredNamespace
): string {
  const heading = namespace.description === "" ?
    namespace.name :
    `${namespace.name}: ${namespace.description}`;
  const members = namespaceMembers(namespace);

  return members === "" ? heading : `${heading}\n${members}`;
}

function namespaceMembers(
  namespace: RegisteredNamespace
): string {
  const commands = [...namespace.commands()]
    .sort(byName)
    .map((command) => [signature(command), command.description]);
  const variables = [...namespace.variables()]
    .sort(byName)
    .map((variable) => [variableSignature(variable), variable.description]);

  return [
    section("Commands", commands),
    section("Variables", variables)
  ].filter((part) => part !== "").join("\n");
}

function describeCommand(
  command: RegisteredCommand
): string {
  return table([[signature(command), command.description]]);
}

function section(
  title: string,
  rows: string[][]
): string {
  if (rows.length === 0) {
    return "";
  }

  return `${title}\n${table(rows, "  ")}`;
}

function table(
  rows: string[][],
  indent = ""
): string {
  const width = Math.max(...rows.map(([left]) => left.length));

  return rows
    .map(([left, right]) => {
      const row = right === "" ? left : `${left.padEnd(width)}  ${right}`;

      return `${indent}${row}`;
    })
    .join("\n");
}
