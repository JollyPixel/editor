export * from "./Server.ts";
export {
  UngatedExtensionError,
  UnknownDefaultRoleError
} from "./errors.ts";
export * from "./extension/Extension.ts";
export * from "./extension/PresenceOnlyExtension.ts";
export * from "./rights/index.ts";
export * from "./auth/index.ts";
export type { Logger } from "./logger.ts";
export type {
  RoomResolution,
  RoomResolver
} from "./room/RoomResolver.ts";
