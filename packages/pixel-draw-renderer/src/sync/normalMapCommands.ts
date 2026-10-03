// Import Internal Dependencies
import type { NormalMapCommand } from "../buffer/hooks.ts";
import { NormalMapConfig } from "../normal/NormalMapConfig.ts";

// CONSTANTS
const kActions: { readonly [TAction in NormalMapCommandAction]: true; } = {
  "normal-map-toggled": true,
  "normal-map-defaults-patched": true,
  "normal-map-zone-set": true,
  "normal-map-zone-deleted": true
};

export type NormalMapCommandAction = NormalMapCommand["action"];

export function isNormalMapCommand<TCommand extends { action: string; }>(
  command: TCommand
): command is Extract<TCommand, { action: NormalMapCommandAction; }> {
  return Object.hasOwn(kActions, command.action);
}

export function applyNormalMapCommand(
  config: NormalMapConfig | null,
  command: NormalMapCommand
): NormalMapConfig | null {
  switch (command.action) {
    case "normal-map-toggled":
      return command.metadata.config === null ?
        null :
        NormalMapConfig.from(command.metadata.config);

    case "normal-map-defaults-patched":
      return config?.withDefaults(command.metadata.patch) ?? null;

    case "normal-map-zone-set":
      return config?.withZone(
        command.metadata.zone,
        command.metadata.index
      ) ?? null;

    case "normal-map-zone-deleted":
      return config?.withoutZone(command.metadata.regionId) ?? null;
  }
}
