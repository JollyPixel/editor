// Import Internal Dependencies
import type {
  ArgDef,
  CommandDef,
  RegisteredCommand,
  RegisteredMember,
  RegisteredNamespace,
  RegisteredVariable,
  RegistrationHandle,
  VariableDef
} from "./types.ts";
import {
  assertArgs,
  assertIdentifier,
  assertVariableDef
} from "./validation.ts";

interface CommandSlot {
  command: RegisteredCommand;
  lifetime: AbortController;
}

export interface NamespaceEntryOptions {
  name: string;
  description?: string;
  onChange: () => void;
}

export class NamespaceEntry implements RegisteredNamespace {
  readonly kind = "namespace";
  readonly name: string;
  readonly address: string;
  readonly description: string;

  #prefix: string;
  #onChange: () => void;
  #commands = new Map<string, CommandSlot>();
  #variables = new Map<string, RegisteredVariable>();

  constructor(
    options: NamespaceEntryOptions
  ) {
    this.name = options.name;
    this.address = options.name;
    this.description = options.description ?? "";
    this.#prefix = options.name === "" ? "" : `${options.name}.`;
    this.#onChange = options.onChange;
  }

  command(
    name: string
  ): RegisteredCommand | undefined {
    return this.#commands.get(name.toLowerCase())?.command;
  }

  variable(
    name: string
  ): RegisteredVariable | undefined {
    return this.#variables.get(name.toLowerCase());
  }

  * commands(): IterableIterator<RegisteredCommand> {
    for (const slot of this.#commands.values()) {
      yield slot.command;
    }
  }

  variables(): IterableIterator<RegisteredVariable> {
    return this.#variables.values();
  }

  * [Symbol.iterator](): IterableIterator<RegisteredMember> {
    yield* this.commands();
    yield* this.variables();
  }

  registerCommand<const TArgs extends readonly ArgDef[]>(
    name: string,
    def: CommandDef<TArgs>
  ): RegistrationHandle {
    assertIdentifier(name);
    const address = this.#prefix + name;
    assertArgs(address, def.args);

    const key = name.toLowerCase();
    const lifetime = new AbortController();
    const slot: CommandSlot = {
      command: {
        kind: "command",
        name,
        address,
        description: def.description,
        namespace: this,
        def,
        signal: lifetime.signal
      },
      lifetime
    };
    this.#commands.get(key)?.lifetime.abort();
    this.#commands.set(key, slot);
    this.#onChange();

    return {
      unregister: () => {
        if (this.#commands.get(key) !== slot) {
          return;
        }
        this.#commands.delete(key);
        lifetime.abort();
        this.#onChange();
      }
    };
  }

  registerVariable<const TValue extends string>(
    name: string,
    def: VariableDef<TValue>
  ): RegistrationHandle {
    assertIdentifier(name);
    const address = this.#prefix + name;
    assertVariableDef(address, def);

    const key = name.toLowerCase();
    const entry: RegisteredVariable = {
      kind: "variable",
      name,
      address,
      description: def.description,
      namespace: this,
      def
    };
    this.#variables.set(key, entry);
    this.#onChange();

    return {
      unregister: () => {
        if (this.#variables.get(key) !== entry) {
          return;
        }
        this.#variables.delete(key);
        this.#onChange();
      }
    };
  }

  clear(): void {
    for (const slot of this.#commands.values()) {
      slot.lifetime.abort();
    }
    this.#commands.clear();
    this.#variables.clear();
  }
}
