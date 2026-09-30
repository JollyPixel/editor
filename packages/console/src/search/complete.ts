// Import Internal Dependencies
import { classify } from "../input/classify.ts";
import {
  quote,
  type Token
} from "../input/tokenize.ts";
import {
  label,
  signature
} from "../registry/format.ts";
import type {
  ArgDef,
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredEntry,
  RegisteredNamespace,
  RegisteredVariable,
  VariableDef
} from "../registry/types.ts";
import { prefixTypoDistance } from "./typo.ts";

// CONSTANTS
const kBooleanValues = ["true", "false"];

export interface Completion {
  value: string;
  label: string;
  detail: string;
  entry: RegisteredEntry | null;
}

export interface CompletionList {
  start: number;
  end: number;
  items: Completion[];
  hint: string | null;
}

export interface AppliedCompletion {
  text: string;
  caret: number;
}

interface CaretToken {
  index: number;
  start: number;
  end: number;
  typed: string;
}

export async function complete(
  input: string,
  caret: number,
  registry: ConsoleRegistry
): Promise<CompletionList> {
  const classified = classify(input, registry);
  if (classified.mode === "search") {
    return empty(caret);
  }

  const current = tokenAt(input, caret, classified.tokens);
  if (classified.mode === "variable") {
    const { variable } = classified;
    if (current.index === 0) {
      const items = addressCompletions(registry, current.typed, "variable");

      return list(current, items, null);
    }
    if (current.index === 1) {
      const items = valueCompletions(staticValues(variable.def), current.typed);

      return list(current, items, String(variable.def.get()));
    }

    return empty(caret);
  }

  if (current.index === 0) {
    const typed = current.typed.slice(1);

    return list(current, addressCompletions(registry, typed, "command"), null);
  }

  const { command } = classified;
  if (command === undefined) {
    return empty(caret);
  }
  const args = command.def.args;
  const last = args.at(-1);
  const arg = args[current.index - 1] ?? (last?.rest ? last : undefined);
  const hint = signature(command);
  if (arg === undefined) {
    return list(current, [], hint);
  }

  const values = await argValues(arg);

  return list(current, valueCompletions(values, current.typed, arg), hint);
}

export function applyCompletion(
  input: string,
  list: CompletionList,
  completion: Completion
): AppliedCompletion {
  const text = input.slice(0, list.start) +
    completion.value +
    input.slice(list.end);

  return {
    text,
    caret: list.start + completion.value.length
  };
}

function tokenAt(
  input: string,
  caret: number,
  tokens: Token[]
): CaretToken {
  const index = tokens
    .findIndex((token) => token.start <= caret && caret <= token.end);
  if (index === -1) {
    return {
      index: tokens.filter((token) => token.end < caret).length,
      start: caret,
      end: caret,
      typed: ""
    };
  }

  const token = tokens[index];

  return {
    index,
    start: token.start,
    end: token.end,
    typed: token.quoted ? token.value : input.slice(token.start, caret)
  };
}

function addressCompletions(
  registry: ConsoleRegistry,
  typed: string,
  mode: "command" | "variable"
): Completion[] {
  const lowered = typed.toLowerCase();
  const prefix = mode === "command" ? `/${lowered}` : lowered;
  const matches = scopedAddresses(registry, typed, mode)
    .filter((completion) => completion.value.toLowerCase().startsWith(prefix));
  if (matches.length > 0) {
    return matches.sort(byValue);
  }

  const everyAddress = [registry.root, ...registry.namespaces()]
    .flatMap((namespace) => members(namespace, mode));

  return corrections(everyAddress, typed, mode === "command" ? 1 : 0);
}

function scopedAddresses(
  registry: ConsoleRegistry,
  typed: string,
  mode: "command" | "variable"
): Completion[] {
  const dot = typed.indexOf(".");
  if (dot !== -1) {
    const namespace = registry.namespace(typed.slice(0, dot));

    return namespace === undefined ? [] : members(namespace, mode);
  }

  const completions = members(registry.root, mode);
  for (const namespace of registry.namespaces()) {
    if (mode === "command") {
      completions.push(...members(namespace, mode));
    }
    else {
      completions.push({
        value: `${namespace.name}.`,
        label: `${namespace.name}.`,
        detail: namespace.description,
        entry: namespace
      });
    }
  }

  return completions;
}

function members(
  namespace: RegisteredNamespace,
  mode: "command" | "variable"
): Completion[] {
  const commands = [...namespace.commands()].map(entryCompletion);
  if (mode === "command") {
    return commands;
  }

  return [
    ...[...namespace.variables()].map(entryCompletion),
    ...commands
  ];
}

function entryCompletion(
  entry: RegisteredCommand | RegisteredVariable
): Completion {
  const text = label(entry);

  return {
    value: text,
    label: text,
    detail: entry.def.description,
    entry
  };
}

function staticValues(
  def: ArgDef | VariableDef
): readonly string[] {
  switch (def.type) {
    case "boolean":
      return kBooleanValues;
    case "enum":
      return def.enumValues;
    default:
      return [];
  }
}

async function argValues(
  arg: ArgDef
): Promise<readonly string[]> {
  if (arg.autocomplete === undefined) {
    return staticValues(arg);
  }

  try {
    return await arg.autocomplete();
  }
  catch {
    return [];
  }
}

function valueCompletions(
  values: readonly string[],
  typed: string,
  arg?: ArgDef
): Completion[] {
  const lowered = typed.toLowerCase();
  const completions = values.map((value) => {
    return {
      value: arg?.rest ? value : quote(value),
      label: value,
      detail: arg?.name ?? "",
      entry: null
    };
  });
  const matches = completions
    .filter((completion) => completion.label.toLowerCase().startsWith(lowered));

  return matches.length > 0 ? matches : corrections(completions, typed, 0);
}

function corrections(
  completions: Completion[],
  typed: string,
  offset: number
): Completion[] {
  const ranked: { completion: Completion; distance: number; }[] = [];
  for (const completion of completions) {
    const found = prefixTypoDistance(typed, completion.label.slice(offset));
    if (found !== null) {
      ranked.push({
        completion,
        distance: found
      });
    }
  }

  return ranked
    .sort((left, right) => left.distance - right.distance ||
      byValue(left.completion, right.completion))
    .map(({ completion }) => completion);
}

function byValue(
  left: Completion,
  right: Completion
): number {
  return left.value.localeCompare(right.value);
}

function list(
  current: CaretToken,
  items: Completion[],
  hint: string | null
): CompletionList {
  return {
    start: current.start,
    end: current.end,
    items,
    hint
  };
}

function empty(
  caret: number
): CompletionList {
  return {
    start: caret,
    end: caret,
    items: [],
    hint: null
  };
}
