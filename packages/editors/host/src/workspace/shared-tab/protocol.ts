// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const DISCOVERY_TIMEOUT_MS = 5_000;
export const DISCOVERY_INTERVAL_MS = 100;

const kChannelPrefix = "jolly-workspace-channel:";
const kOwnerMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hello"),
    tab: z.string()
  }),
  z.object({
    type: z.literal("owner"),
    tab: z.string(),
    owner: z.string()
  })
]);

export type OwnerPort = Pick<BroadcastChannel, "postMessage">;
export type OwnerMessage = z.infer<typeof kOwnerMessageSchema>;

export function openBridgeChannel(
  name: string
): BroadcastChannel {
  return new BroadcastChannel(kChannelPrefix + name);
}

export function openSocketChannel(
  name: string,
  socket: string
): BroadcastChannel {
  return new BroadcastChannel(`${kChannelPrefix}${name}:${socket}`);
}

export function parseOwnerMessage(
  value: unknown
): OwnerMessage | undefined {
  const result = kOwnerMessageSchema.safeParse(value);

  return result.success ? result.data : undefined;
}
