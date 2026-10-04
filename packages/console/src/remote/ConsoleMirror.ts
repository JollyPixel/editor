// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import type {
  CommandContext,
  ConsoleValue,
  RegistrationHandle,
  VariableSetResult
} from "../registry/types.ts";
import { RemoteCancelledError } from "./errors/RemoteCancelledError.ts";
import {
  isServerMessage,
  isSettledAs,
  type MirrorMessage,
  type MirrorRequestBody,
  type OutputMessage,
  type RemoteArgValues,
  type ServerMessage,
  type ServerReply,
  type SettledReply,
  type SnapshotMessage
} from "./protocol.ts";
import {
  RemoteNamespace,
  type RemoteCalls
} from "./RemoteNamespace.ts";

// CONSTANTS
const kNoNamespaces: ReadonlyMap<string, RemoteNamespace> = new Map();

export interface ConsoleMirrorOptions {
  onConflict?: (namespace: string) => void;
}

interface Registration {
  readonly shape: string;
  readonly handle: RegistrationHandle;
}

interface PendingRequest {
  receive(reply: ServerReply): void;
  abandon(): void;
}

interface RequestOptions {
  label?: string;
  signal?: AbortSignal;
  onOutput?: (reply: OutputMessage) => void;
}

export class ConsoleMirror {
  #port: MessagePort;
  #commands: CommandConsole;
  #onConflict: ((namespace: string) => void) | undefined;
  #active = false;
  #namespaces: ReadonlyMap<string, RemoteNamespace> = kNoNamespaces;
  #values = new Map<string, ConsoleValue>();
  #registered = new Map<string, Registration>();
  #conflicts = new Set<string>();
  #requests = new Map<number, PendingRequest>();
  #nextRequestId = 0;
  #listening = new AbortController();
  #unsubscribe: () => void;

  readonly #calls: RemoteCalls = {
    execute: (address, args, ctx) => this.#execute(address, args, ctx),
    complete: (address, arg) => this.#complete(address, arg),
    read: (address) => this.#values.get(address),
    write: (address, value) => this.#write(address, value)
  };

  constructor(
    port: MessagePort,
    commands: CommandConsole,
    options: ConsoleMirrorOptions = {}
  ) {
    this.#port = port;
    this.#commands = commands;
    this.#onConflict = options.onConflict;
    port.addEventListener("message", this.#onMessage, {
      signal: this.#listening.signal
    });
    this.#unsubscribe = commands.subscribe("opened", () => {
      if (this.#active) {
        this.refresh();
      }
    });
    port.start();
  }

  get active(): boolean {
    return this.#active;
  }

  set active(
    value: boolean
  ) {
    this.#active = value;
    this.#reconcile();
    if (value) {
      this.refresh();
    }
  }

  refresh(): void {
    this.#post({
      type: "refresh"
    });
  }

  close(): void {
    this.#unsubscribe();
    this.#namespaces = kNoNamespaces;
    this.#reconcile();
    this.#listening.abort();
    for (const request of this.#requests.values()) {
      request.abandon();
    }
    this.#port.close();
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    if (isServerMessage(event.data)) {
      this.#receive(event.data);
    }
  };

  #receive(
    message: ServerMessage
  ): void {
    if (message.type === "snapshot") {
      this.#sync(message);
    }
    else {
      this.#requests.get(message.requestId)?.receive(message);
    }
  }

  #sync(
    snapshot: SnapshotMessage
  ): void {
    this.#values = new Map(Object.entries(snapshot.values));
    this.#namespaces = new Map(snapshot.namespaces.map((data) => {
      const namespace = new RemoteNamespace(data);

      return [namespace.key, namespace];
    }));
    this.#reconcile();
  }

  #reconcile(): void {
    const wanted = this.#active ? this.#namespaces : kNoNamespaces;
    for (const [key, registration] of this.#registered) {
      if (wanted.get(key)?.shape !== registration.shape) {
        registration.handle.unregister();
        this.#registered.delete(key);
      }
    }
    for (const namespace of wanted.values()) {
      if (!this.#registered.has(namespace.key)) {
        this.#register(namespace);
      }
    }
  }

  #register(
    namespace: RemoteNamespace
  ): void {
    if (this.#commands.registry.namespace(namespace.name) === undefined) {
      this.#registered.set(namespace.key, {
        shape: namespace.shape,
        handle: namespace.register(this.#commands, this.#calls)
      });
    }
    else if (!this.#conflicts.has(namespace.key)) {
      this.#conflicts.add(namespace.key);
      this.#onConflict?.(namespace.name);
    }
  }

  async #execute(
    address: string,
    args: RemoteArgValues,
    ctx: CommandContext
  ): Promise<void> {
    await this.#request(
      {
        type: "execute",
        address,
        args
      },
      "done",
      {
        label: `/${address}`,
        signal: ctx.signal,
        onOutput: (reply) => {
          if (reply.kind === "error") {
            ctx.error(reply.text);
          }
          else {
            ctx.print(reply.text);
          }
        }
      }
    );
  }

  async #complete(
    address: string,
    arg: string
  ): Promise<readonly string[]> {
    try {
      const reply = await this.#request(
        {
          type: "complete",
          address,
          arg
        },
        "completions"
      );

      return reply.values;
    }
    catch {
      return [];
    }
  }

  async #write(
    address: string,
    value: ConsoleValue
  ): Promise<VariableSetResult> {
    const reply = await this.#request(
      {
        type: "write",
        address,
        literal: String(value)
      },
      "written"
    );
    this.#values.set(address, reply.value);

    return reply.accepted ? undefined : false;
  }

  #request<TType extends SettledReply["type"]>(
    body: MirrorRequestBody,
    expected: TType,
    options: RequestOptions = {}
  ): Promise<Extract<SettledReply, { type: TType; }>> {
    const cancelled = new RemoteCancelledError(options.label ?? body.address);
    if (this.#listening.signal.aborted || options.signal?.aborted) {
      return Promise.reject(cancelled);
    }

    const {
      promise,
      resolve,
      reject
    } = Promise.withResolvers<Extract<SettledReply, { type: TType; }>>();
    const requestId = this.#nextRequestId++;
    const settled = new AbortController();
    const settle = () => {
      this.#requests.delete(requestId);
      settled.abort();
    };
    this.#requests.set(requestId, {
      receive: (reply) => {
        if (reply.type === "output") {
          options.onOutput?.(reply);
        }
        else if (reply.type === "failed") {
          settle();
          reject(new Error(reply.message));
        }
        else if (isSettledAs(reply, expected)) {
          settle();
          resolve(reply);
        }
      },
      abandon: () => {
        settle();
        reject(cancelled);
      }
    });
    options.signal?.addEventListener("abort", () => {
      this.#post({
        type: "cancel",
        requestId
      });
      this.#requests.get(requestId)?.abandon();
    }, { signal: settled.signal });
    this.#post({
      ...body,
      requestId
    });

    return promise;
  }

  #post(
    message: MirrorMessage
  ): void {
    if (!this.#listening.signal.aborted) {
      this.#port.postMessage(message);
    }
  }
}
