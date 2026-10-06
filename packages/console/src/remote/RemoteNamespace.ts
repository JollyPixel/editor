// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import type {
  ArgDef,
  CommandContext,
  CommandResult,
  ConsoleValue,
  RegistrationHandle,
  VariableDef,
  VariableSetResult
} from "../registry/types.ts";
import type {
  RemoteArg,
  RemoteArgValues,
  RemoteNamespaceData,
  RemoteVariable
} from "./protocol.ts";
import { RemoteValueMissingError } from "./errors/RemoteValueMissingError.ts";

export interface RemoteCalls {
  execute(
    address: string,
    args: RemoteArgValues,
    ctx: CommandContext
  ): Promise<CommandResult>;
  complete(
    address: string,
    arg: string
  ): Promise<readonly string[]>;
  read(
    address: string
  ): ConsoleValue | undefined;
  write(
    address: string,
    value: ConsoleValue
  ): Promise<VariableSetResult>;
}

export class RemoteNamespace {
  readonly name: string;
  readonly key: string;
  readonly shape: string;

  #data: RemoteNamespaceData;

  constructor(
    data: RemoteNamespaceData
  ) {
    this.#data = data;
    this.name = data.name;
    this.key = data.name.toLowerCase();
    this.shape = JSON.stringify(data);
  }

  register(
    commands: CommandConsole,
    calls: RemoteCalls
  ): RegistrationHandle {
    const namespace = commands.registerNamespace(this.name, {
      description: this.#data.description
    });
    for (const command of this.#data.commands) {
      const address = `${this.name}.${command.name}`;
      namespace.registerCommand(command.name, {
        description: command.description,
        args: command.args.map(
          (arg) => this.#arg(address, arg, calls)
        ),
        closeOnExecute: command.closeOnExecute,
        execute: (args, ctx) => calls.execute(address, args, ctx)
      });
    }
    for (const variable of this.#data.variables) {
      namespace.registerVariable(
        variable.name,
        this.#variable(variable, calls)
      );
    }

    return namespace;
  }

  #arg(
    address: string,
    remote: RemoteArg,
    calls: RemoteCalls
  ): ArgDef {
    const { completes, ...arg } = remote;

    return completes ?
      {
        ...arg,
        autocomplete: () => calls.complete(address, arg.name)
      } :
      arg;
  }

  #variable(
    remote: RemoteVariable,
    calls: RemoteCalls
  ): VariableDef {
    const { name, ...variable } = remote;
    const address = `${this.name}.${name}`;
    function read(): ConsoleValue {
      const value = calls.read(address);
      if (value === undefined) {
        throw new RemoteValueMissingError(address);
      }

      return value;
    }
    function set(
      value: ConsoleValue
    ): Promise<VariableSetResult> {
      return calls.write(address, value);
    }

    switch (variable.type) {
      case "number":
        return {
          ...variable,
          get: () => Number(read()),
          set
        };
      case "boolean":
        return {
          ...variable,
          get: () => read() === true,
          set
        };
      default:
        return {
          ...variable,
          get: () => String(read()),
          set
        };
    }
  }
}
