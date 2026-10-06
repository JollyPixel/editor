// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import {
  peekValue,
  writeVariable
} from "../execution/variables.ts";
import type {
  ArgDef,
  ConsoleValue,
  RegisteredCommand,
  RegisteredNamespace,
  RegisteredVariable
} from "../registry/types.ts";
import {
  isMirrorMessage,
  type CompleteMessage,
  type ExecuteMessage,
  type FailedMessage,
  type MirrorMessage,
  type RemoteArg,
  type RemoteCommand,
  type RemoteNamespaceData,
  type RemoteVariable,
  type ServerMessage,
  type ServerReply,
  type WriteMessage
} from "./protocol.ts";

export class ConsoleServer {
  #commands: CommandConsole;
  #port: MessagePort;
  #running = new Map<number, AbortController>();
  #listening = new AbortController();
  #unsubscribe: () => void;
  #scheduled = false;

  constructor(
    commands: CommandConsole,
    port: MessagePort
  ) {
    this.#commands = commands;
    this.#port = port;
    port.addEventListener("message", this.#onMessage, {
      signal: this.#listening.signal
    });
    this.#unsubscribe = commands.subscribe(
      "registry-changed",
      this.#scheduleSnapshot
    );
    port.start();
    this.#postSnapshot();
  }

  close(): void {
    this.#listening.abort();
    this.#unsubscribe();
    for (const controller of this.#running.values()) {
      controller.abort();
    }
    this.#running.clear();
    this.#port.close();
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    if (isMirrorMessage(event.data)) {
      this.#receive(event.data);
    }
  };

  #receive(
    message: MirrorMessage
  ): void {
    switch (message.type) {
      case "execute":
        void this.#answer(message.requestId, this.#execute(message));
        break;
      case "complete":
        void this.#answer(message.requestId, this.#complete(message));
        break;
      case "write":
        void this.#answer(message.requestId, this.#write(message));
        break;
      case "cancel":
        this.#running.get(message.requestId)?.abort();
        break;
      case "refresh":
        this.#postSnapshot();
        break;
    }
  }

  async #answer(
    requestId: number,
    reply: Promise<ServerReply>
  ): Promise<void> {
    try {
      this.#post(await reply);
    }
    catch (error) {
      this.#post(this.#failed(
        requestId,
        error instanceof Error ? error.message : String(error)
      ));
    }
  }

  async #execute(
    message: ExecuteMessage
  ): Promise<ServerReply> {
    const { requestId, address } = message;
    const command = this.#commands.registry.resolveCommand(address);
    if (command === undefined) {
      return this.#failed(requestId, `Unknown command "/${address}"`);
    }

    const controller = new AbortController();
    this.#running.set(requestId, controller);
    try {
      await command.def.execute(message.args, {
        print: (text) => this.#output(requestId, "info", text),
        error: (text) => this.#output(requestId, "error", text),
        signal: AbortSignal.any([controller.signal, command.signal])
      });

      return {
        type: "done",
        requestId
      };
    }
    finally {
      this.#running.delete(requestId);
      this.#scheduleSnapshot();
    }
  }

  async #complete(
    message: CompleteMessage
  ): Promise<ServerReply> {
    const command = this.#commands.registry.resolveCommand(message.address);
    const arg = command?.def.args.find(
      (candidate) => candidate.name === message.arg
    );

    return {
      type: "completions",
      requestId: message.requestId,
      values: await arg?.autocomplete?.() ?? []
    };
  }

  async #write(
    message: WriteMessage
  ): Promise<ServerReply> {
    const { requestId, address } = message;
    const variable = this.#commands.registry.resolveVariable(address);
    if (variable === undefined) {
      return this.#failed(requestId, `Unknown variable "${address}"`);
    }

    try {
      const result = await writeVariable(variable.def, message.literal);

      return {
        type: "written",
        requestId,
        accepted: result !== false,
        value: variable.def.get()
      };
    }
    finally {
      this.#scheduleSnapshot();
    }
  }

  #failed(
    requestId: number,
    message: string
  ): FailedMessage {
    return {
      type: "failed",
      requestId,
      message
    };
  }

  #output(
    requestId: number,
    kind: "info" | "error",
    text: string
  ): void {
    this.#post({
      type: "output",
      requestId,
      kind,
      text
    });
  }

  readonly #scheduleSnapshot = (): void => {
    if (this.#scheduled) {
      return;
    }

    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (!this.#listening.signal.aborted) {
        this.#postSnapshot();
      }
    });
  };

  #postSnapshot(): void {
    const namespaces = [...this.#commands.registry.namespaces()];
    const values: Record<string, ConsoleValue> = {};
    for (const namespace of namespaces) {
      for (const variable of namespace.variables()) {
        const value = peekValue(variable);
        if (value !== undefined) {
          values[variable.address] = value;
        }
      }
    }

    this.#post({
      type: "snapshot",
      namespaces: namespaces.map(
        (namespace) => this.#describeNamespace(namespace)
      ),
      values
    });
  }

  #describeNamespace(
    namespace: RegisteredNamespace
  ): RemoteNamespaceData {
    return {
      name: namespace.name,
      description: namespace.description,
      commands: [...namespace.commands()].map(
        (command) => this.#describeCommand(command)
      ),
      variables: [...namespace.variables()].map(
        (variable) => this.#describeVariable(variable)
      )
    };
  }

  #describeCommand(
    command: RegisteredCommand
  ): RemoteCommand {
    return {
      name: command.name,
      description: command.def.description,
      args: command.def.args.map((arg) => this.#describeArg(arg)),
      closeOnExecute: command.def.closeOnExecute
    };
  }

  #describeArg(
    arg: ArgDef
  ): RemoteArg {
    const { autocomplete, ...remote } = arg;

    return {
      ...remote,
      completes: autocomplete !== undefined
    };
  }

  #describeVariable(
    variable: RegisteredVariable
  ): RemoteVariable {
    const { get: _get, set: _set, ...remote } = variable.def;

    return {
      ...remote,
      name: variable.name
    };
  }

  #post(
    message: ServerMessage
  ): void {
    this.#port.postMessage(message);
  }
}
