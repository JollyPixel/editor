// Import Internal Dependencies
import { peekValue } from "../execution/variables.ts";
import {
  classify,
  type CommandInput,
  type VariableInput
} from "../input/classify.ts";
import {
  quote,
  type Token
} from "../input/tokenize.ts";
import {
  isWithin,
  relativeAddress
} from "../registry/address.ts";
import {
  compareText,
  signature
} from "../registry/format.ts";
import type {
  ArgDef,
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredEntry,
  RegisteredMember,
  RegisteredNamespace,
  RegisteredVariable,
  VariableDef
} from "../registry/types.ts";
import type { Suggestion } from "./suggestion.ts";
import { prefixTypoDistance } from "./typo.ts";

// CONSTANTS
const kBooleanValues = ["true", "false"];
const kNoCandidates: Candidates = {
  candidates: [],
  hint: null
};

type AddressMode = "command" | "variable";

export interface CompletionList {
  items: Suggestion[];
  hint: string | null;
}

interface CaretToken {
  index: number;
  start: number;
  end: number;
  typed: string;
}

interface Candidate {
  key: string;
  value: string;
  label: string;
  detail: string;
  entry: RegisteredEntry | null;
}

interface Candidates {
  candidates: Candidate[];
  hint: string | null;
}

export async function complete(
  input: string,
  caret: number,
  registry: ConsoleRegistry
): Promise<CompletionList> {
  const classified = classify(input, registry);
  if (classified.mode === "search") {
    return {
      items: [],
      hint: null
    };
  }

  const current = tokenAt(input, caret, classified.tokens);
  const { candidates, hint } = await candidatesAt(
    classified,
    current,
    registry
  );

  return {
    items: candidates.map(
      (candidate) => suggestion(input, current, candidate)
    ),
    hint
  };
}

async function candidatesAt(
  classified: CommandInput | VariableInput,
  current: CaretToken,
  registry: ConsoleRegistry
): Promise<Candidates> {
  if (classified.mode === "variable") {
    return variableCandidates(classified.variable, current, registry);
  }

  if (current.index === 0) {
    return {
      candidates: addressCandidates(
        registry,
        current.typed.slice(1),
        "command"
      ),
      hint: null
    };
  }

  const { command } = classified;
  if (command === undefined) {
    return kNoCandidates;
  }
  const arg = argumentAt(command, current.index);

  return {
    candidates: arg === undefined ?
      [] :
      valueCandidates(await argValues(arg), current.typed, arg),
    hint: signature(command)
  };
}

function variableCandidates(
  variable: RegisteredVariable,
  current: CaretToken,
  registry: ConsoleRegistry
): Candidates {
  switch (current.index) {
    case 0:
      return {
        candidates: addressCandidates(registry, current.typed, "variable"),
        hint: null
      };
    case 1: {
      const value = peekValue(variable);

      return {
        candidates: valueCandidates(
          staticValues(variable.def),
          current.typed
        ),
        hint: value === undefined ? null : String(value)
      };
    }
    default:
      return kNoCandidates;
  }
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

function argumentAt(
  command: RegisteredCommand,
  index: number
): ArgDef | undefined {
  const { args } = command.def;
  const last = args.at(-1);

  return args[index - 1] ?? (last?.rest ? last : undefined);
}

function addressCandidates(
  registry: ConsoleRegistry,
  typed: string,
  mode: AddressMode
): Candidate[] {
  const matches = prefixed(scopedCandidates(registry, typed, mode), typed);
  if (matches.length > 0) {
    return matches.sort(byValue);
  }

  const everyAddress = [...registry].flatMap(
    (scope) => Array.from(
      mode === "command" ? scope.commands() : scope,
      (entry) => entryCandidate(entry, entry.address, mode)
    )
  );

  return corrections(everyAddress, typed);
}

function scopedCandidates(
  registry: ConsoleRegistry,
  typed: string,
  mode: AddressMode
): Candidate[] {
  const dot = typed.lastIndexOf(".");
  if (dot !== -1) {
    const namespace = registry.namespace(typed.slice(0, dot));

    return namespace === undefined ?
      [] :
      listing(registry, namespace, typed.slice(0, dot + 1), mode);
  }

  const { root, scope } = registry;
  const candidates = listing(registry, scope, "", mode);
  if (scope !== root) {
    candidates.push(...listing(registry, root, "", mode));
  }

  return distinct(candidates);
}

function listing(
  registry: ConsoleRegistry,
  namespace: RegisteredNamespace,
  prefix: string,
  mode: AddressMode
): Candidate[] {
  if (mode === "command") {
    return [...registry]
      .filter((scope) => scope === namespace ||
        isWithin(scope.address, namespace.address))
      .flatMap((scope) => Array.from(
        scope.commands(),
        (command) => entryCandidate(
          command,
          prefix + relativeAddress(command.address, namespace.address),
          mode
        )
      ));
  }

  const candidates = Array.from(
    namespace,
    (entry) => entryCandidate(entry, prefix + entry.name, mode)
  );
  for (const child of registry.children(namespace)) {
    const text = `${prefix}${child.name}.`;
    candidates.push({
      key: text,
      value: text,
      label: text,
      detail: child.description,
      entry: child
    });
  }

  return candidates;
}

function entryCandidate(
  entry: RegisteredMember,
  address: string,
  mode: AddressMode
): Candidate {
  const text = entry.kind === "command" ? `/${address}` : address;

  return {
    key: mode === "command" ? address : text,
    value: text,
    label: text,
    detail: entry.description,
    entry
  };
}

function distinct(
  candidates: Candidate[]
): Candidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.value.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);

    return true;
  });
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

function valueCandidates(
  values: readonly string[],
  typed: string,
  arg?: ArgDef
): Candidate[] {
  const candidates = values.map((value) => {
    return {
      key: value,
      value: arg?.rest ? value : quote(value),
      label: value,
      detail: arg?.name ?? "",
      entry: null
    };
  });
  const matches = prefixed(candidates, typed);

  return matches.length > 0 ? matches : corrections(candidates, typed);
}

function prefixed(
  candidates: Candidate[],
  typed: string
): Candidate[] {
  const lowered = typed.toLowerCase();

  return candidates
    .filter((candidate) => candidate.key.toLowerCase().startsWith(lowered));
}

function corrections(
  candidates: Candidate[],
  typed: string
): Candidate[] {
  const ranked: { candidate: Candidate; distance: number; }[] = [];
  for (const candidate of candidates) {
    const found = prefixTypoDistance(typed, candidate.key);
    if (found !== null) {
      ranked.push({
        candidate,
        distance: found
      });
    }
  }

  return ranked
    .sort((left, right) => left.distance - right.distance ||
      byValue(left.candidate, right.candidate))
    .map(({ candidate }) => candidate);
}

function byValue(
  left: Candidate,
  right: Candidate
): number {
  return compareText(left.value, right.value);
}

function suggestion(
  input: string,
  current: CaretToken,
  candidate: Candidate
): Suggestion {
  const text = input.slice(0, current.start) +
    candidate.value +
    input.slice(current.end);

  return {
    label: candidate.label,
    detail: candidate.detail,
    entry: candidate.entry,
    match: null,
    checked: null,
    text,
    caret: current.start + candidate.value.length,
    run: false
  };
}
