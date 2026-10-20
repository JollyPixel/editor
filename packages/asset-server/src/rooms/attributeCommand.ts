// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

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
