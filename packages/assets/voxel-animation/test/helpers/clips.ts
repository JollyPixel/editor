// Import Third-party Dependencies
import type { NetworkCommandHeader } from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AnimationClipJSON,
  AnimationCommand,
  AnimationInterpolation,
  AnimationKeyJSON,
  AnimationNetworkCommand
} from "#src/network/types.ts";

let seq = 0;

export function clip(
  id: string,
  overrides: Partial<AnimationClipJSON> = {}
): AnimationClipJSON {
  return {
    id,
    name: id,
    length: 24000,
    fps: 24,
    loop: true,
    tracks: [],
    ...overrides
  };
}

export function key(
  tick: number,
  x: number,
  interpolation: AnimationInterpolation = "linear"
): AnimationKeyJSON {
  return {
    tick,
    value: { x, y: 0, z: 0 },
    interpolation
  };
}

export function networkCommand<T extends AnimationCommand>(
  command: T,
  overrides: Partial<NetworkCommandHeader> = {}
): T & AnimationNetworkCommand {
  seq++;

  return {
    ...command,
    clientId: "client-A",
    seq,
    timestamp: 1000 + seq,
    ...overrides
  } as T & AnimationNetworkCommand;
}
