// Import Internal Dependencies
import type { NetworkCommandHeader } from "./types.ts";

export function attributeCommand<
  TCommand extends Partial<NetworkCommandHeader>
>(
  command: TCommand,
  clientId: string
): TCommand {
  if (typeof command.timestamp === "number") {
    return {
      ...command,
      clientId,
      timestamp: Math.min(command.timestamp, Date.now())
    };
  }

  return {
    ...command,
    clientId
  };
}
