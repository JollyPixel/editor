// Import Third-party Dependencies
import { match } from "ts-pattern";

// Import Internal Dependencies
import {
  Extension,
  type RoomBroadcast,
  type RoomContext,
  type RoomEventStoreHandle,
  type WorkerExtensionDescriptor
} from "../Extension.ts";
import type { Logger } from "../logger.ts";
import {
  PendingCallRegistry,
  PendingCallTimeoutError
} from "./PendingCallRegistry.ts";
import {
  NodeWorkerTransport,
  type WorkerTransport,
  type WorkerTransportFactory
} from "./WorkerTransport.ts";
import type {
  DispatchArgsMap,
  DispatchMethod,
  HostWorkerData,
  WorkerContextCall,
  WorkerContextResponse,
  WorkerToMainMessage
} from "./protocol.ts";
import type {
  ClientHandle,
  PeerMetadata
} from "../../types.ts";

// CONSTANTS
const kDefaultRpcTimeoutMs = 10_000;
const kDefaultMaxRestarts = 5;
const kDefaultRestartWindowMs = 60_000;

export interface WorkerExtensionProxyOptions {
  logger: Logger;
  transportFactory?: WorkerTransportFactory;
}

function resolveHostEntryUrl(): URL {
  // Static literals (not a template) so bundlers resolve this as a single
  // asset import rather than a directory glob over "./WorkerExtensionHost.*"
  // (which would also pick up sibling .d.ts/.map files).
  return import.meta.url.endsWith(".ts") ?
    new URL("./WorkerExtensionHost.ts", import.meta.url) :
    new URL("./WorkerExtensionHost.js", import.meta.url);
}

function errorMessage(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

const kWorkerToMainTypes = new Set(["ready", "dispatch-result", "context-call"]);

function isWorkerToMainMessage(
  value: unknown
): value is WorkerToMainMessage {
  return typeof value === "object" && value !== null &&
    "type" in value && typeof value.type === "string" &&
    kWorkerToMainTypes.has(value.type);
}

/**
 * Runs an Extension inside a dedicated worker_threads.Worker, presenting it to
 * ServerRoom/Server as an ordinary Extension.
 */
export class WorkerExtensionProxy extends Extension {
  readonly id: string;
  readonly name: string;

  #descriptor: WorkerExtensionDescriptor;
  #logger: Logger;
  #transportFactory: WorkerTransportFactory;
  #transport: WorkerTransport | undefined;

  #readyPromise!: Promise<void>;
  #resolveReady: (() => void) | undefined;
  #rejectReady: ((error: Error) => void) | undefined;

  #dead = false;
  #dispatchCalls = new PendingCallRegistry<void>();
  #dispatchChain: Promise<void> = Promise.resolve();
  #restartTimestamps: number[] = [];

  // Stable for the room's lifetime — captured from the first dispatch's context.
  #roomBroadcast: RoomBroadcast | undefined;
  // Only valid while a dispatch is in flight (dispatches are serialized).
  #currentEventStore: RoomEventStoreHandle | undefined;

  constructor(
    descriptor: WorkerExtensionDescriptor,
    options: WorkerExtensionProxyOptions
  ) {
    super();
    this.id = descriptor.id;
    this.name = descriptor.name;
    this.#descriptor = descriptor;
    this.#logger = options.logger.withContext({
      room: descriptor.id
    });
    this.#transportFactory = options.transportFactory ??
      ((workerData) => new NodeWorkerTransport(resolveHostEntryUrl(), workerData));

    this.#spawn();
  }

  override getEventName(
    payload: unknown
  ): string {
    return this.#descriptor.getEventName ?
      this.#descriptor.getEventName(payload) :
      super.getEventName(payload);
  }

  onClientConnect(
    client: ClientHandle,
    identity: PeerMetadata,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onClientConnect",
      [client.id, identity],
      context
    );
  }

  onClientDisconnect(
    clientId: string,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onClientDisconnect",
      [clientId],
      context
    );
  }

  onMessage(
    clientId: string,
    payload: unknown,
    context: RoomContext
  ): Promise<void> {
    return this.#dispatch(
      "onMessage",
      [clientId, payload],
      context
    );
  }

  async close(): Promise<void> {
    this.#dead = true;
    await this.#transport?.terminate();
  }

  #spawn(): void {
    const hostData: HostWorkerData = {
      id: this.#descriptor.id,
      modulePath: String(this.#descriptor.modulePath),
      exportName: this.#descriptor.exportName,
      extensionWorkerData: this.#descriptor.workerData
    };

    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.#readyPromise = promise;
    this.#resolveReady = resolve;
    this.#rejectReady = reject;

    const transport = this.#transportFactory(hostData);
    this.#transport = transport;
    transport.onMessage((message) => {
      if (isWorkerToMainMessage(message)) {
        this.#handleWorkerMessage(message);
      }
    });
    transport.onError((error) => this.#handleFailure(error));
    transport.onExit((code) => {
      // A deliberate close() already set #dead before terminating — an intentional
      // shutdown, not a crash, so skip failure-handling regardless of exit code
      // (terminate()'s reported code isn't reliably 0 on every platform).
      if (code !== 0 && !this.#dead) {
        this.#handleFailure(new Error(`worker exited with code ${code}`));
      }
    });
  }

  #dispatch<TMethod extends DispatchMethod>(
    method: TMethod,
    args: DispatchArgsMap[TMethod],
    context: RoomContext
  ): Promise<void> {
    const run = (): Promise<void> => this.#dispatchNow(method, args, context);
    const result = this.#dispatchChain.then(run, run);

    this.#dispatchChain = result.catch(() => void 0);

    return result;
  }

  async #dispatchNow<TMethod extends DispatchMethod>(
    method: TMethod,
    args: DispatchArgsMap[TMethod],
    context: RoomContext
  ): Promise<void> {
    if (this.#dead) {
      this.#logger
        .withMetadata({
          method,
          outcome: "dropped",
          reason: "extension dead"
        })
        .warn("worker dispatch");

      return;
    }

    await this.#readyPromise;

    this.#roomBroadcast ??= context.room;
    this.#currentEventStore = context.eventStore;

    const timeoutMs = this.#descriptor.rpcTimeoutMs ?? kDefaultRpcTimeoutMs;
    const { id: dispatchId, promise } = this.#dispatchCalls.create({
      timeoutMs,
      timeoutMessage: `worker dispatch "${method}" timed out after ${timeoutMs}ms`
    });

    this.#transport?.postMessage({
      type: "dispatch",
      id: dispatchId,
      method,
      args
    });

    try {
      await promise;
    }
    catch (error) {
      if (error instanceof PendingCallTimeoutError) {
        this.#handleFailure(error);
      }
      throw error;
    }
  }

  #handleWorkerMessage(
    message: WorkerToMainMessage
  ): void {
    match(message)
      .with({ type: "ready" }, () => {
        this.#resolveReady?.();
      })
      .with({ type: "dispatch-result" }, (message) => {
        if (message.ok) {
          this.#dispatchCalls.resolve(message.id, undefined);
        }
        else {
          this.#dispatchCalls.reject(
            message.id,
            new Error(message.error ?? "worker dispatch failed")
          );
        }
      })
      .with({ type: "context-call" }, (message) => {
        this.#handleContextCall(message);
      })
      .exhaustive();
  }

  #handleContextCall(
    call: WorkerContextCall
  ): void {
    match(call)
      .with({ method: "room.broadcast" }, (call) => {
        const [payload] = call.args;
        this.#roomBroadcast?.broadcast(payload);
      })
      .with({ method: "client.send" }, (call) => {
        const [clientId, data] = call.args;
        this.#roomBroadcast?.sendTo(clientId, data);
      })
      .with({ method: "eventStore.append" }, (call) => {
        const [input] = call.args;
        void this.#replyToContextCall(
          call.id,
          this.#currentEventStore?.append(input) ?? Promise.resolve(false)
        );
      })
      .with({ method: "eventStore.list" }, (call) => {
        const [assetId, fromVersion] = call.args;
        void this.#replyToContextCall(
          call.id,
          this.#currentEventStore?.list(assetId, fromVersion) ?? Promise.resolve([])
        );
      })
      .exhaustive();
  }

  async #replyToContextCall(
    id: string | undefined,
    valuePromise: Promise<unknown>
  ): Promise<void> {
    if (id === undefined) {
      return;
    }

    let response: WorkerContextResponse;
    try {
      const value = await valuePromise;
      response = {
        type: "context-response",
        id,
        ok: true,
        value
      };
    }
    catch (error) {
      response = {
        type: "context-response",
        id,
        ok: false,
        error: errorMessage(error)
      };
    }

    this.#transport?.postMessage(response);
  }

  #handleFailure(
    error: Error
  ): void {
    this.#logger.withError(error).error("worker failure");

    this.#rejectReady?.(error);
    this.#dispatchCalls.rejectAll(error);

    void this.#transport?.terminate();
    this.#transport = undefined;

    if (this.#dead) {
      return;
    }

    const windowMs = this.#descriptor.restartWindowMs ?? kDefaultRestartWindowMs;
    const maxRestarts = this.#descriptor.maxRestarts ?? kDefaultMaxRestarts;
    const now = Date.now();
    this.#restartTimestamps = this.#restartTimestamps.filter(
      (timestamp) => now - timestamp < windowMs
    );
    this.#restartTimestamps.push(now);

    if (this.#restartTimestamps.length > maxRestarts) {
      this.#dead = true;
      this.#logger
        .withMetadata({ maxRestarts, windowMs })
        .error("extension marked dead after exceeding restart cap");

      return;
    }

    this.#spawn();
  }
}
