// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { PeerMetadata } from "../../types.ts";

export interface DispatchArgsMap {
  onClientConnect: [clientId: string, identity: PeerMetadata];
  onClientDisconnect: [clientId: string];
  onMessage: [clientId: string, payload: unknown];
}

export type DispatchMethod = keyof DispatchArgsMap;

export type WorkerDispatch = {
  [TMethod in DispatchMethod]: {
    type: "dispatch";
    id: string;
    method: TMethod;
    args: DispatchArgsMap[TMethod];
  };
}[DispatchMethod];

export interface WorkerContextResponse {
  type: "context-response";
  id: string;
  ok: boolean;
  value?: unknown;
  error?: string;
}

export type MainToWorkerMessage = WorkerDispatch | WorkerContextResponse;

export interface WorkerReady {
  type: "ready";
}

export interface WorkerDispatchResult {
  type: "dispatch-result";
  id: string;
  ok: boolean;
  error?: string;
}

export interface ContextCallArgsMap {
  "room.broadcast": [payload: unknown];
  "eventStore.append": [input: EventStore.AppendInput];
  "eventStore.list": [assetId: string, fromVersion: number | undefined];
  "client.send": [clientId: string, data: unknown];
}

export type ContextCallMethod = keyof ContextCallArgsMap;

// Calls awaiting a reply from the main thread carry a required correlation id;
// fire-and-forget calls (room.broadcast, client.send) don't.
type ContextCallsAwaitingReply = "eventStore.append" | "eventStore.list";

export type WorkerContextCall = {
  [TMethod in ContextCallMethod]: {
    type: "context-call";
    method: TMethod;
    args: ContextCallArgsMap[TMethod];
  } & (TMethod extends ContextCallsAwaitingReply ? { id: string; } : { id?: string; });
}[ContextCallMethod];

export type WorkerToMainMessage =
  | WorkerReady
  | WorkerDispatchResult
  | WorkerContextCall;

export interface HostWorkerData {
  id: string;
  modulePath: string;
  exportName?: string;
  extensionWorkerData?: unknown;
}
