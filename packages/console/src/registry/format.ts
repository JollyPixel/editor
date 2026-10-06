// Import Internal Dependencies
import type {
  ArgDef,
  RegisteredCommand,
  RegisteredEntry,
  RegisteredVariable
} from "./types.ts";

export function label(
  entry: RegisteredEntry
): string {
  return entry.kind === "command" ? `/${entry.address}` : entry.address;
}

export function byName(
  left: { name: string; },
  right: { name: string; }
): number {
  return left.name.localeCompare(right.name);
}

export function signature(
  command: RegisteredCommand
): string {
  const args = command.def.args.map(formatArg);

  return [label(command), ...args].join(" ");
}

export function variableSignature(
  variable: RegisteredVariable
): string {
  const { def } = variable;
  const type = def.type === "enum" ? def.enumValues.join("|") : def.type;

  return `${variable.address} <${type}>`;
}

function formatArg(
  arg: ArgDef
): string {
  let text = arg.name;
  if (arg.type === "enum") {
    text += `:${arg.enumValues.join("|")}`;
  }
  else if (arg.type !== "string") {
    text += `:${arg.type}`;
  }
  if (arg.rest) {
    text += "...";
  }

  return arg.required ? `<${text}>` : `[${text}]`;
}
