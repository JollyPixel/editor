// Import Internal Dependencies
import { RecordingExtension } from "./RecordingExtension.ts";
import { ServerRoom } from "#src/server/room/ServerRoom.ts";
import type {
  Extension,
  MessageProtocols,
  RightsTable
} from "#src/index.ts";

export function createExtension(
  protocols?: MessageProtocols
): RecordingExtension {
  return new RecordingExtension("pixel-draw", "pixel-draw", protocols);
}

export function createRoom(
  extension: Extension,
  rights?: RightsTable
): ServerRoom {
  return new ServerRoom(extension.id, extension, rights);
}
