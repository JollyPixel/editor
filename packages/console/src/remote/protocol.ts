// Import Internal Dependencies
import type {
  ArgDef,
  ConsoleScalar,
  ConsoleValue,
  VariableDef
} from "../registry/types.ts";

// CONSTANTS
const kServerMessageTypes = new Set([
  "snapshot",
  "output",
  "done",
  "failed",
  "completions",
  "written"
]);
const kMirrorMessageTypes = new Set([
  "execute",
  "cancel",
  "complete",
  "write",
  "revert",
  "refresh"
]);

type DistributiveOmit<T, TKey extends PropertyKey> =
  T extends unknown ? Omit<T, TKey> : never;

export type RemoteArg = DistributiveOmit<ArgDef, "autocomplete"> & {
  completes: boolean;
};

export interface RemoteCommand {
  name: string;
  description: string;
  args: readonly RemoteArg[];
  closeOnExecute?: boolean;
}

export type RemoteVariable = DistributiveOmit<VariableDef, "get" | "set"> & {
  name: string;
};

export interface RemoteNamespaceData {
  name: string;
  description: string;
  commands: readonly RemoteCommand[];
  variables: readonly RemoteVariable[];
}

export type RemoteArgValues = Readonly<
  Record<string, ConsoleScalar | undefined>
>;

export interface SnapshotMessage {
  type: "snapshot";
  namespaces: readonly RemoteNamespaceData[];
  values: Readonly<Record<string, ConsoleValue>>;
}

export interface OutputMessage {
  type: "output";
  requestId: number;
  kind: "info" | "error";
  text: string;
}

export interface DoneMessage {
  type: "done";
  requestId: number;
  revertId?: number;
}

export interface FailedMessage {
  type: "failed";
  requestId: number;
  message: string;
}

export interface CompletionsMessage {
  type: "completions";
  requestId: number;
  values: readonly string[];
}

export interface WrittenMessage {
  type: "written";
  requestId: number;
  accepted: boolean;
  value: ConsoleValue;
}

export type SettledReply =
  | DoneMessage
  | CompletionsMessage
  | WrittenMessage;

export type ServerReply =
  | OutputMessage
  | FailedMessage
  | SettledReply;

export type ServerMessage =
  | SnapshotMessage
  | ServerReply;

export interface ExecuteMessage {
  type: "execute";
  requestId: number;
  address: string;
  args: RemoteArgValues;
}

export interface CancelMessage {
  type: "cancel";
  requestId: number;
}

export interface CompleteMessage {
  type: "complete";
  requestId: number;
  address: string;
  arg: string;
}

export interface WriteMessage {
  type: "write";
  requestId: number;
  address: string;
  literal: string;
}

export interface RevertMessage {
  type: "revert";
  requestId: number;
  address: string;
  revertId: number;
}

export interface RefreshMessage {
  type: "refresh";
}

export type MirrorRequest =
  | ExecuteMessage
  | CompleteMessage
  | WriteMessage
  | RevertMessage;

export type MirrorRequestBody = DistributiveOmit<MirrorRequest, "requestId">;

export type MirrorMessage =
  | MirrorRequest
  | CancelMessage
  | RefreshMessage;

export function isServerMessage(
  data: unknown
): data is ServerMessage {
  return hasType(data, kServerMessageTypes);
}

export function isMirrorMessage(
  data: unknown
): data is MirrorMessage {
  return hasType(data, kMirrorMessageTypes);
}

export function isSettledAs<TType extends SettledReply["type"]>(
  reply: ServerReply,
  type: TType
): reply is Extract<SettledReply, { type: TType; }> {
  return reply.type === type;
}

function hasType(
  data: unknown,
  types: ReadonlySet<string>
): boolean {
  return typeof data === "object" &&
    data !== null &&
    "type" in data &&
    typeof data.type === "string" &&
    types.has(data.type);
}
