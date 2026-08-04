// Import Node.js Dependencies
import {
  parentPort,
  workerData
} from "node:worker_threads";

// Import Third-party Dependencies
import { match } from "ts-pattern";
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  Extension,
  RoomContext
} from "../Extension.ts";
import type {
  ClientHandle
} from "../../types.ts";
import { createLogger } from "../logger.ts";
import { PendingCallRegistry } from "./PendingCallRegistry.ts";
import type {
  ContextCallMethod,
  HostWorkerData,
  MainToWorkerMessage,
  WorkerContextResponse,
  WorkerDispatch,
  WorkerDispatchResult,
  WorkerReady
} from "./protocol.ts";

function isHostWorkerData(
  value: unknown
): value is HostWorkerData {
  return typeof value === "object" && value !== null &&
    "id" in value && typeof value.id === "string" &&
    "modulePath" in value && typeof value.modulePath === "string";
}

const kMainToWorkerTypes = new Set(["dispatch", "context-response"]);

function isMainToWorkerMessage(
  value: unknown
): value is MainToWorkerMessage {
  return typeof value === "object" && value !== null &&
    "type" in value && typeof value.type === "string" &&
    kMainToWorkerTypes.has(value.type);
}

if (!parentPort) {
  throw new Error("WorkerExtensionHost must run inside a worker_threads.Worker");
}
if (!isHostWorkerData(workerData)) {
  throw new Error("WorkerExtensionHost received malformed workerData");
}

const port = parentPort;
const {
  id, modulePath, exportName, extensionWorkerData
} = workerData;
const logger = createLogger(id).withContext({
  room: id
});

const contextCalls = new PendingCallRegistry();

function postContextCall(
  method: ContextCallMethod,
  args: unknown[],
  id?: string
): void {
  port.postMessage({ type: "context-call", id, method, args });
}

async function requestAppend(
  input: EventStore.AppendInput
): Promise<boolean> {
  const { id: callId, promise } = contextCalls.create();
  postContextCall("eventStore.append", [input], callId);

  return promise.then((value) => {
    if (typeof value !== "boolean") {
      throw new Error("context call failed");
    }

    return value;
  });
}

async function requestList(
  assetId: string,
  fromVersion: number | undefined
): Promise<EventStore.Event[]> {
  const { id: callId, promise } = contextCalls.create();
  postContextCall("eventStore.list", [assetId, fromVersion], callId);

  return promise.then((value) => {
    if (!Array.isArray(value)) {
      throw new Error("context call failed");
    }

    return value;
  });
}

/**
 * Not bound to a specific clientId: per-client routing (e.g. notifying the
 * originating client on an append failure) happens on the main thread, inside
 * the real RoomContext the WorkerExtensionProxy delegates these calls to.
 */
function createContext(): RoomContext {
  return {
    room: {
      broadcast: (payload) => postContextCall("room.broadcast", [payload]),
      sendTo: (clientId, payload) => postContextCall("client.send", [clientId, payload])
    },
    eventStore: {
      append: requestAppend,
      list: requestList
    }
  };
}

function createClientHandle(
  clientId: string
): ClientHandle {
  return {
    id: clientId,
    send: (data) => postContextCall("client.send", [clientId, data])
  };
}

async function dispatch(
  extension: Extension,
  message: WorkerDispatch
): Promise<void> {
  await match(message)
    .with({ method: "onClientConnect" }, (message) => {
      const [clientId, identity] = message.args;

      return extension.onClientConnect(
        createClientHandle(clientId),
        identity,
        createContext()
      );
    })
    .with({ method: "onClientDisconnect" }, (message) => {
      const [clientId] = message.args;

      return extension.onClientDisconnect(
        clientId,
        createContext()
      );
    })
    .with({ method: "onMessage" }, (message) => {
      const [clientId, payload] = message.args;

      return extension.onMessage(
        clientId,
        payload,
        createContext()
      );
    })
    .exhaustive();
}

function handleContextResponse(
  message: WorkerContextResponse
): void {
  if (message.ok) {
    contextCalls.resolve(
      message.id,
      message.value
    );
  }
  else {
    contextCalls.reject(
      message.id,
      new Error(message.error ?? "context call failed")
    );
  }
}

// Left unhandled on purpose: a throw here is fatal to the worker and surfaces
// as an "error" event on the main thread's Worker instance, which is the
// crash-detection signal WorkerExtensionProxy relies on for startup failures.
const mod = await import(modulePath);
const Ctor = mod[exportName ?? "default"];
const extension: Extension = new Ctor(extensionWorkerData);

port.on("message", (raw: unknown) => {
  if (!isMainToWorkerMessage(raw)) {
    return;
  }

  match(raw)
    .with({ type: "context-response" }, (message) => {
      handleContextResponse(message);
    })
    .with({ type: "dispatch" }, (message) => {
      dispatch(extension, message)
        .then(() => {
          const result: WorkerDispatchResult = {
            type: "dispatch-result",
            id: message.id,
            ok: true
          };
          port.postMessage(result);
        })
        .catch((error: Error) => {
          logger.withError(error).error("dispatch failed");
          const result: WorkerDispatchResult = {
            type: "dispatch-result",
            id: message.id,
            ok: false,
            error: error.message
          };
          port.postMessage(result);
        });
    })
    .exhaustive();
});

const ready: WorkerReady = {
  type: "ready"
};
port.postMessage(ready);
