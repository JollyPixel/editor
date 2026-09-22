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
  switch (entry.kind) {
    case "command":
      return `/${entry.address}`;
    case "variable":
      return entry.address;
    default:
      return entry.name;
  }
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
