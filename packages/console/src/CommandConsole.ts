// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  classify,
  type CommandInput
} from "./input/classify.ts";
import { bindArguments } from "./execution/bindArguments.ts";
import { registerBuiltins } from "./execution/builtins.ts";
import { ConsoleInputError } from "./execution/errors/ConsoleInputError.ts";
import { InputHistory } from "./execution/InputHistory.ts";
import {
  Scrollback,
  type ScrollbackEntry,
  type ScrollbackKind
} from "./execution/Scrollback.ts";
import { accessVariable } from "./execution/variables.ts";
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
import { closestAddress } from "./search/typo.ts";

export type CommandConsoleEvents = {
  "registry-changed": () => void;
  "scrollback-changed": () => void;
  "open-requested": () => void;
  "close-requested": () => void;
};

export class CommandConsole extends Emitter<
  CommandConsoleEvents
> implements ConsoleNamespace {
  readonly history = new InputHistory();

  #scrollback = new Scrollback();
  #registry = new Registry(
    () => this.emit("registry-changed")
  );

  constructor() {
    super();

    registerBuiltins(this);
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
          this.#append("info", accessVariable(input));
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
      const result = command.def.execute(values, {
        print: (text) => this.#append("info", text),
        error: (text) => this.#append("error", text),
        signal: controller.signal
      });
      if (result instanceof Promise) {
        this.#updatePending(echo, true);
        try {
          await result;
        }
        finally {
          this.#updatePending(echo, false);
        }
      }
    }
    finally {
      command.signal.removeEventListener("abort", abort);
    }

    if (command.def.closeOnExecute) {
      this.close();
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

function didYouMean(
  message: string,
  guess: string | null
): string {
  return guess === null ? message : `${message}. Did you mean ${guess}?`;
}
