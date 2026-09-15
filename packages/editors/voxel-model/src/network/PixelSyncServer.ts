// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import {
  pixelArtSnapshot,
  type PixelBuffer
} from "@jolly-pixel/pixel-draw.renderer";
import {
  applyCommandToBuffer,
  PixelCommandArbiter,
  pixelCommandProtocol,
  pixelSnapshotSchema,
  type PixelNetworkCommand
} from "@jolly-pixel/asset.pixel-art/network/server.ts";

export interface PixelSyncServerOptions {
  id: string;
  buffer: PixelBuffer;
  /** @default network.LastWriteWinsResolver */
  conflictResolver?: network.ConflictResolver;
}

export class PixelSyncServer extends network.Extension<PixelNetworkCommand> {
  readonly id: string;
  readonly name = "pixel-art";
  readonly protocols: network.MessageProtocols;

  #buffer: PixelBuffer;
  #arbiter: PixelCommandArbiter;

  constructor(
    options: PixelSyncServerOptions
  ) {
    super();
    const {
      id,
      buffer,
      conflictResolver
    } = options;

    this.id = id;
    this.protocols = {
      inbound: pixelCommandProtocol,
      outbound: network.serverMessageProtocol({
        command: pixelCommandProtocol,
        snapshot: pixelSnapshotSchema
      })
    };
    this.#buffer = buffer;
    this.#arbiter = new PixelCommandArbiter({ conflictResolver });
  }

  override onClientConnect(
    client: network.ClientHandle,
    _peer: network.RoomPeer,
    _context: network.RoomContext
  ): void {
    client.send({
      type: "snapshot",
      data: pixelArtSnapshot(this.#buffer)
    });
  }

  override onMessage(
    _clientId: string,
    command: PixelNetworkCommand,
    context: network.RoomContext
  ): void {
    const admitted = this.#arbiter.admit(this.#buffer, command);
    if (admitted === null) {
      return;
    }

    applyCommandToBuffer(this.#buffer, admitted.command);
    admitted.commit();

    context.room.broadcast({
      type: "command",
      data: admitted.command
    });
  }
}
