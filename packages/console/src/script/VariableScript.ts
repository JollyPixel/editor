// Import Internal Dependencies
import { peekValue } from "../execution/variables.ts";
import {
  coerce,
  formatValue,
  isListVariable
} from "../input/coerce.ts";
import { isWithin } from "../registry/address.ts";
import { typeLabel } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  ConsoleValue,
  ConsoleValueType,
  RegisteredNamespace,
  RegisteredVariable,
  VariableDef
} from "../registry/types.ts";
import {
  closest,
  closestAddress,
  didYouMean
} from "../search/typo.ts";
import {
  formatScriptValue,
  parseScriptValue,
  scanScript,
  type EntryLine,
  type ScriptSpan
} from "./scanScript.ts";
import {
  ScriptDraft,
  type ScriptChange,
  type ScriptDiagnostic
} from "./ScriptDraft.ts";

interface ParseState {
  section: string | null;
  seen: Map<string, number>;
  changes: ScriptChange[];
  diagnostics: ScriptDiagnostic[];
  valueTypes: Map<number, ConsoleValueType>;
}

export class VariableScript {
  readonly scope: string | null;
  readonly text: string;

  #registry: ConsoleRegistry;
  #snapshot = new Map<string, ConsoleValue>();

  constructor(
    registry: ConsoleRegistry,
    scope: string | null = null
  ) {
    this.#registry = registry;
    this.scope = scope;
    this.text = this.#write(
      scope === null ? [...registry] : [...subtree(registry, scope)]
    );
  }

  get empty(): boolean {
    return this.#snapshot.size === 0;
  }

  parse(
    text: string
  ): ScriptDraft {
    const lines = scanScript(text);
    const state: ParseState = {
      section: "",
      seen: new Map(),
      changes: [],
      diagnostics: [],
      valueTypes: new Map()
    };

    lines.forEach((line, index) => {
      const number = index + 1;
      switch (line.kind) {
        case "section":
          state.section = this.#enterSection(
            line.name,
            line.closed,
            number,
            state
          );
          break;
        case "entry":
          if (state.section !== null) {
            this.#readEntry(line, number, state);
          }
          break;
        case "invalid":
          report(state, number, wholeLine(line.text), "Expected name = value");
          break;
        default:
          break;
      }
    });

    return new ScriptDraft({
      lines,
      changes: state.changes,
      diagnostics: state.diagnostics,
      valueTypes: state.valueTypes
    });
  }

  #write(
    namespaces: Array<RegisteredNamespace | undefined>
  ): string {
    const blocks: string[][] = [];
    for (const namespace of namespaces) {
      if (namespace === undefined) {
        continue;
      }

      const block: string[] = [];
      for (const variable of namespace.variables()) {
        const value = peekValue(variable);
        if (value === undefined) {
          continue;
        }
        this.#snapshot.set(variable.address.toLowerCase(), value);
        block.push(
          `; ${describe(variable)}`,
          `${variable.name} = ${scriptValue(value)}`
        );
      }
      if (block.length === 0) {
        continue;
      }

      if (namespace.address !== "") {
        block.unshift(`[${namespace.address}]`);
        if (namespace.description !== "") {
          block.unshift(`; ${namespace.description}`);
        }
      }
      blocks.push(block);
    }

    return blocks.map((block) => block.join("\n")).join("\n\n");
  }

  #enterSection(
    name: ScriptSpan,
    closed: boolean,
    number: number,
    state: ParseState
  ): string | null {
    if (!closed) {
      report(state, number, name, "Expected \"]\" at the end of the section");
    }
    if (name.text === "") {
      report(state, number, name, "Expected a namespace name");

      return null;
    }

    const namespace = this.#registry.namespace(name.text);
    if (namespace === undefined) {
      const names = Array.from(this.#registry.namespaces(), (entry) => entry.address);
      report(
        state,
        number,
        name,
        didYouMean(`Unknown namespace "${name.text}"`, closest(name.text, names))
      );

      return null;
    }

    return namespace.address;
  }

  #readEntry(
    line: EntryLine,
    number: number,
    state: ParseState
  ): void {
    const { key, value } = line;
    if (key.text === "") {
      report(state, number, operatorSpan(line), "Expected a name before =");

      return;
    }

    const address = state.section === "" ? key.text : `${state.section}.${key.text}`;
    const variable = this.#registry.resolveVariable(address);
    if (variable === undefined) {
      report(
        state,
        number,
        key,
        didYouMean(
          `Unknown variable "${address}"`,
          closestAddress(address, this.#registry, "variable")
        )
      );

      return;
    }

    const { def } = variable;
    state.valueTypes.set(number, highlightType(def));
    const id = variable.address.toLowerCase();
    const first = state.seen.get(id);
    if (first !== undefined) {
      report(state, number, key, `${variable.address} is already set on line ${first}`);

      return;
    }
    state.seen.set(id, number);

    const valueSpan = value.text === "" ? operatorSpan(line) : value;
    let parsed: ConsoleValue;
    try {
      const literal = isListVariable(def) ?
        value.text :
        parseScriptValue(value.text);
      parsed = coerce(literal, def);
    }
    catch (error) {
      report(state, number, valueSpan, error instanceof Error ? error.message : String(error));

      return;
    }

    const previous = this.#snapshot.has(id) ?
      this.#snapshot.get(id) :
      peekValue(variable);
    if (previous === undefined || formatValue(parsed) !== formatValue(previous)) {
      state.changes.push({
        line: number,
        address: variable.address,
        value: parsed
      });
    }
  }
}

function describe(
  variable: RegisteredVariable
): string {
  const type = typeLabel(variable.def);

  return variable.description === "" ?
    `<${type}>` :
    `${variable.description} <${type}>`;
}

function highlightType(
  def: VariableDef
): ConsoleValueType {
  switch (def.type) {
    case "string[]":
      return "string";
    case "number[]":
      return "number";
    case "boolean[]":
      return "boolean";
    default:
      return def.type;
  }
}

function scriptValue(
  value: ConsoleValue
): string {
  return typeof value === "object" ?
    formatValue(value) :
    formatScriptValue(String(value));
}

function* subtree(
  registry: ConsoleRegistry,
  scope: string
): IterableIterator<RegisteredNamespace> {
  for (const namespace of registry.namespaces()) {
    const { address } = namespace;
    if (address.toLowerCase() === scope.toLowerCase() || isWithin(address, scope)) {
      yield namespace;
    }
  }
}

function report(
  state: ParseState,
  line: number,
  span: Pick<ScriptSpan, "start" | "end">,
  message: string
): void {
  state.diagnostics.push({
    line,
    start: span.start,
    end: span.end,
    message
  });
}

function operatorSpan(
  line: EntryLine
): Pick<ScriptSpan, "start" | "end"> {
  return {
    start: line.operator,
    end: line.operator + 1
  };
}

function wholeLine(
  text: string
): Pick<ScriptSpan, "start" | "end"> {
  const start = text.length - text.trimStart().length;

  return {
    start,
    end: text.trimEnd().length
  };
}
