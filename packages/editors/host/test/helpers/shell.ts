// Import Internal Dependencies
import type { LaunchMessage } from "#src/shell/protocol.ts";
import {
  ShellChannel,
  type ShellPort
} from "#src/shell/ShellChannel.ts";

// CONSTANTS
export const SHELL_ORIGIN = "http://studio.test";

export interface ShellChannelFixture extends Partial<
  Omit<LaunchMessage, "type">
> {
  port?: ShellPort;
  origin?: string;
}

export function shellChannel(
  fixture: ShellChannelFixture = {}
): ShellChannel {
  const {
    port = { postMessage: () => undefined },
    origin = SHELL_ORIGIN,
    ...launch
  } = fixture;

  return new ShellChannel({
    port,
    origin,
    launch: {
      type: "jolly-launch",
      target: "launch-target",
      identity: null,
      preferences: {},
      ports: {},
      ...launch
    }
  });
}
