// Import Third-party Dependencies
import type { EditableDocumentKind } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  scriptCommandProtocol,
  scriptCommandSchema
} from "./ScriptCommand.schema.ts";
import {
  textDocumentKind,
  type SyncedScript
} from "./textDocumentKind.ts";
import type {
  ScriptCommand,
  ScriptRoom
} from "./types.ts";

export type TextEditableKind<TKind extends string = string> = EditableDocumentKind<
  TKind,
  ScriptRoom,
  SyncedScript,
  ScriptCommand
>;

export function textEditableKind<TKind extends string>(
  kind: TKind
): TextEditableKind<TKind> {
  return {
    ...textDocumentKind(kind),
    commandSchema: scriptCommandSchema,
    commandProtocol: scriptCommandProtocol,
    localEdits: (synced) => synced
  };
}
