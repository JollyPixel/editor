// Import Internal Dependencies
import type {
  ArgDef,
  RegisteredCommand,
  RegisteredEntry,
  RegisteredVariable
} from "./types.ts";

// CONSTANTS
const kCollator = new Intl.Collator();

export function label(
  entry: RegisteredEntry
): string {
  return entry.kind === "command" ? `/${entry.address}` : entry.address;
}

export function byName(
  left: { name: string; },
  right: { name: string; }
): number {
  return compareText(left.name, right.name);
}

export function compareText(
  left: string,
  right: string
): number {
  return kCollator.compare(left, right);
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
