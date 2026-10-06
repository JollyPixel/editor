// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  classify,
  type CommandInput,
  type VariableInput
} from "./input/classify.ts";
import { bindArguments } from "./execution/bindArguments.ts";
import { registerBuiltins } from "./execution/builtins.ts";
import { ConsoleInputError } from "./execution/errors/ConsoleInputError.ts";
import { InputHistory } from "./execution/InputHistory.ts";
import { RevertStack } from "./execution/RevertStack.ts";
import {
  Scrollback,
  type ScrollbackEntry,
  type ScrollbackKind
} from "./execution/Scrollback.ts";
import {
  accessVariable,
  peekValue,
  restoreVariable,
  restoreVariables,
  writeVariable,
  type VariableRestore
} from "./execution/variables.ts";
import { quote } from "./input/tokenize.ts";
import { Registry } from "./registry/Registry.ts";
import type {
  ArgDef,
  CommandDef,
  ConsoleNamespace,
  ConsoleRegistry,
  NamespaceMeta,
  RegistrationHandle,
  VariableDef
} from "./registry/types.ts";
import {
  closestAddress,
  didYouMean
} from "./search/typo.ts";
import type {
  ScriptChange,
  ScriptDraft
} from "./script/ScriptDraft.ts";
import { VariableScript } from "./script/VariableScript.ts";

export type CommandConsoleEvents = {
  "registry-changed": () => void;
  "scrollback-changed": () => void;
  "open-requested": () => void;
  "close-requested": () => void;
  opened: () => void;
  "script-requested": (script: VariableScript) => void;
};

export type ScriptResult =
  | {
    ok: true;
    applied: number;
  }
  | {
    ok: false;
    error: string;
  };

export class CommandConsole extends Emitter<
  CommandConsoleEvents
> implements ConsoleNamespace {
  readonly history = new InputHistory();

  #scrollback = new Scrollback();
  #registry = new Registry(
    () => this.emit("registry-changed")
  );
  #reverts = new RevertStack(this.#registry);

  constructor() {
    super();

    registerBuiltins(this, this.#reverts);
  }

  get registry(): ConsoleRegistry {
    return this.#registry;
  }

  get scrollback(): readonly ScrollbackEntry[] {
    return this.#scrollback.entries;
  }

  registerNamespace(
    name: string,
    meta?: NamespaceMeta
  ): ConsoleNamespace {
    return this.#registry.registerNamespace(
      name,
      meta
    );
  }

  registerCommand<const TArgs extends readonly ArgDef[]>(
    name: string,
    def: CommandDef<TArgs>
  ): RegistrationHandle {
    return this.#registry.root.registerCommand(
      name,
      def
    );
  }

  registerVariable<const TValue extends string>(
    name: string,
    def: VariableDef<TValue>
  ): RegistrationHandle {
    return this.#registry.root.registerVariable(
      name,
      def
    );
  }

  unregister(): void {
    this.#registry.clear();
  }

  open(): void {
    this.emit("open-requested");
  }

  close(): void {
    this.emit("close-requested");
  }

  clearScrollback(): void {
    this.#scrollback.clear();
    this.emit("scrollback-changed");
  }

  editScript(
    namespace?: string
  ): VariableScript {
    let scope: string | null = null;
    if (namespace !== undefined) {
      const entry = this.#registry.namespace(namespace);
      if (entry === undefined) {
        throw new ConsoleInputError(`Unknown namespace "${namespace}"`);
      }
      scope = entry.name;
    }

    const script = new VariableScript(this.#registry, scope);
    if (script.empty) {
      throw new ConsoleInputError(
        scope === null ? "No variables are registered" : `${scope} has no variables`
      );
    }
    this.emit("script-requested", script);

    return script;
  }

  async applyScript(
    draft: ScriptDraft
  ): Promise<ScriptResult> {
    if (!draft.ok) {
      const count = draft.diagnostics.length;

      return {
        ok: false,
        error: count === 1 ? "The script has 1 error" : `The script has ${count} errors`
      };
    }

    const restores: VariableRestore[] = [];
    const lines: string[] = [];
    for (const change of draft.changes) {
      try {
        const restore = await this.#writeChange(change);
        if (restore !== null) {
          restores.push(restore);
        }
      }
      catch (error) {
        const message = await this.#rollback(restores, error);
        this.#append("error", message);

        return {
          ok: false,
          error: message
        };
      }
      lines.push(`${change.address} ${quote(String(change.value))}`);
    }

    if (lines.length > 0) {
      for (const line of lines) {
        this.#append("echo", line);
      }
      this.#reverts.push({
        kind: "script",
        addresses: draft.changes.map((change) => change.address),
        line: `script (${lines.join(", ")})`,
        revert: restoreVariables(this.#registry, restores)
      });
    }

    return {
      ok: true,
      applied: lines.length
    };
  }

  async submit(
    line: string
  ): Promise<void> {
    if (line.trim() === "") {
      return;
    }

    this.history.push(line);
    const echo = this.#append("echo", line);
    const input = classify(
      line,
      this.#registry
    );

    try {
      switch (input.mode) {
        case "variable":
          await this.#accessVariable(
            input,
            line,
            echo
          );
          break;
        case "command":
          await this.#runCommand(
            input,
            line,
            echo
          );
          break;
        default:
          throw new ConsoleInputError(
            didYouMean(
              `"${input.query}" is not a variable; commands start with /`,
              closestAddress(input.query, this.#registry, "variable")
            )
          );
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#append("error", message);
    }
  }

  async #accessVariable(
    input: VariableInput,
    line: string,
    echo: ScrollbackEntry
  ): Promise<void> {
    const { variable } = input;
    const previous = input.tokens.length === 2 ?
      peekValue(variable) :
      undefined;
    const value = await this.#settle(echo, accessVariable(input));
    this.#append("info", value);

    if (previous !== undefined && String(previous) !== value) {
      this.#reverts.push({
        kind: "variable",
        address: variable.address,
        line,
        revert: restoreVariable(this.#registry, variable.address, previous)
      });
    }
  }

  async #runCommand(
    input: CommandInput,
    line: string,
    echo: ScrollbackEntry
  ): Promise<void> {
    const { command } = input;
    if (command === undefined) {
      throw new ConsoleInputError(
        didYouMean(
          `Unknown command "/${input.address}"`,
          closestAddress(input.address, this.#registry, "command")
        )
      );
    }

    const values = bindArguments(
      command,
      input,
      line
    );
    const controller = new AbortController();
    function abort(): void {
      controller.abort();
    }
    command.signal.addEventListener("abort", abort);
    try {
      const revert = await this.#settle(echo, command.def.execute(values, {
        print: (text) => this.#append("info", text),
        error: (text) => this.#append("error", text),
        signal: controller.signal
      }));
      if (typeof revert === "function") {
        this.#reverts.push({
          kind: "command",
          address: command.address,
          line,
          revert
        });
      }
    }
    finally {
      command.signal.removeEventListener("abort", abort);
    }

    if (command.def.closeOnExecute) {
      this.close();
    }
  }

  async #writeChange(
    change: ScriptChange
  ): Promise<VariableRestore | null> {
    const { address, value } = change;
    const variable = this.#registry.resolveVariable(address);
    if (variable === undefined) {
      throw new ConsoleInputError(`Unknown variable "${address}"`);
    }

    const previous = peekValue(variable);
    const result = await writeVariable(variable.def, String(value));
    if (result === false) {
      throw new ConsoleInputError(`${address} rejected "${value}"`);
    }

    return previous === undefined ? null : {
      address,
      previous
    };
  }

  async #rollback(
    restores: readonly VariableRestore[],
    error: unknown
  ): Promise<string> {
    const failed: string[] = [];
    for (const { address, previous } of restores.toReversed()) {
      try {
        await restoreVariable(this.#registry, address, previous)();
      }
      catch {
        failed.push(address);
      }
    }

    const reason = error instanceof Error ? error.message : String(error);

    return failed.length === 0 ?
      `Script not applied: ${reason}` :
      `Script not applied: ${reason}; could not restore ${failed.join(", ")}`;
  }

  async #settle<T>(
    echo: ScrollbackEntry,
    result: T | Promise<T>
  ): Promise<T> {
    if (!(result instanceof Promise)) {
      return result;
    }

    this.#updatePending(echo, true);
    try {
      return await result;
    }
    finally {
      this.#updatePending(echo, false);
    }
  }

  #append(
    kind: ScrollbackKind,
    text: string
  ): ScrollbackEntry {
    const entry = this.#scrollback.append(kind, text);
    this.emit("scrollback-changed");

    return entry;
  }

  #updatePending(
    entry: ScrollbackEntry,
    pending: boolean
  ): void {
    if (this.#scrollback.updatePending(entry.id, pending)) {
      this.emit("scrollback-changed");
    }
  }
}
