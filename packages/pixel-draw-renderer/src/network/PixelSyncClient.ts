// Import Third-party Dependencies
import { toUint8Array } from "js-base64";
import * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import type { PixelArtCanvas } from "../PixelArtCanvas.ts";
import type {
  PixelBufferHookEvent,
  PixelBufferHookListener
} from "../buffer/hooks.ts";
import type {
  PixelBufferSnapshot,
  PixelNetworkCommand,
  PixelServerMessage
} from "./types.ts";

export interface PixelSyncClientOptions {
  room: network.Room<PixelNetworkCommand, PixelServerMessage>;
}

export class PixelSyncClient extends network.SyncAdapter<
  PixelArtCanvas,
  PixelBufferHookEvent,
  PixelNetworkCommand,
  PixelBufferSnapshot
> {
  constructor(
    options: PixelSyncClientOptions
  ) {
    super(options.room);
  }

  protected getHandler(
    canvas: PixelArtCanvas
  ): PixelBufferHookListener | undefined {
    return canvas.onBufferUpdated;
  }

  protected setHandler(
    canvas: PixelArtCanvas,
    fn: PixelBufferHookListener | undefined
  ): void {
    canvas.onBufferUpdated = fn;
  }

  protected override stampCommand(
    event: PixelBufferHookEvent
  ): PixelNetworkCommand {
    const { originTimestamp, ...rest } = event;

    return super.stampCommand(rest, originTimestamp ?? Date.now());
  }

  protected applySnapshot(
    canvas: PixelArtCanvas,
    snapshot: PixelBufferSnapshot
  ): void {
    canvas.loadSnapshot(
      snapshot.size,
      new Uint8ClampedArray(
        toUint8Array(snapshot.pixels)
      ),
      snapshot.uvRegions
    );
  }

  protected applyRemoteCommand(
    canvas: PixelArtCanvas,
    cmd: PixelNetworkCommand
  ): void {
    canvas.applyRemoteCommand(cmd);
  }
}
