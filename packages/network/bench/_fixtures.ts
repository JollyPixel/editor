// Import Third-party Dependencies
import pino from "pino";
import { LogLayer } from "loglayer";
import { PinoTransport } from "@loglayer/transport-pino";
import { mulberry32 } from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  Extension,
  MessageProtocol,
  attributeCommand,
  commandVariant,
  serverMessageProtocol,
  withCommandHeader,
  type ClientHandle,
  type Logger,
  type MessageProtocols,
  type NetworkCommandHeader,
  type PeerIdentity,
  type RightsMap,
  type RoomContext,
  type RoomPeer
} from "../src/index.ts";

// CONSTANTS
const kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const kStrokePoints = 32;

export const ROOM_NAME = "texture:bench";
export const EXTENSION_NAME = "pixel-art";
export const PRESENCE_KEY = "cursor";

export interface BenchCommand extends NetworkCommandHeader {
  action: string;
  color: number;
  xy: number[];
}

export interface BenchSnapshot {
  pixels: string;
}

export function silentLogger(): Logger {
  return new LogLayer({
    transport: new PinoTransport({
      logger: pino({ level: "error" })
    })
  }).setLevel("error");
}

export function actionName(
  variant: number
): string {
  return `stroke-${variant}`;
}

export function commandProtocol(
  variants: number
): MessageProtocol {
  return new MessageProtocol({
    oneOf: Array.from({ length: variants }, (_, variant) => withCommandHeader(
      commandVariant(actionName(variant), {
        color: {
          type: "integer",
          minimum: 0
        },
        xy: {
          type: "array",
          items: {
            type: "integer",
            minimum: 0
          }
        }
      })
    ))
  });
}

export interface BenchProtocols extends MessageProtocols {
  readonly inbound: MessageProtocol;
  readonly outbound: MessageProtocol;
}

export function benchProtocols(
  variants: number
): BenchProtocols {
  const command = commandProtocol(variants);

  return {
    inbound: command,
    outbound: serverMessageProtocol({
      command,
      snapshot: {
        type: "object",
        properties: {
          pixels: {
            type: "string"
          }
        },
        required: ["pixels"]
      }
    })
  };
}

export function strokeCommand(
  variant: number,
  seq = 1,
  clientId = "author"
): BenchCommand {
  return {
    action: actionName(variant),
    clientId,
    seq,
    timestamp: 1_700_000_000_000,
    color: 0xff8800ff,
    xy: Array.from({ length: kStrokePoints }, (_, index) => index * 3)
  };
}

export function snapshotOf(
  bytes: number
): BenchSnapshot {
  const random = mulberry32(bytes);
  let pixels = "";
  for (let index = 0; index < bytes; index++) {
    pixels += kAlphabet[Math.floor(random() * kAlphabet.length)];
  }

  return { pixels };
}

export function cursorPatch(
  step: number
): Record<string, unknown> {
  return {
    [PRESENCE_KEY]: {
      x: step % 512,
      y: (step * 7) % 512
    }
  };
}

export function identityOf(
  subject: string,
  role = "editor"
): PeerIdentity {
  return {
    subject,
    role
  };
}

export const GATED_RIGHTS: RightsMap = {
  editor: {
    "pixel-art.*": "write"
  },
  viewer: {
    "pixel-art.join": "write",
    "pixel-art.*": "read"
  }
};

export class SinkHandle implements ClientHandle {
  readonly id: string;
  bytes = 0;
  messages = 0;

  constructor(
    id: string
  ) {
    this.id = id;
  }

  send(
    data: unknown
  ): void {
    this.sendSerialized(JSON.stringify(data));
  }

  sendSerialized(
    json: string
  ): void {
    this.bytes += json.length;
    this.messages++;
  }
}

export interface EchoExtensionOptions {
  variants: number;
  roomId?: string;
  snapshotBytes?: number;
}

export class EchoExtension extends Extension<BenchCommand> {
  readonly id: string;
  readonly name = EXTENSION_NAME;
  readonly protocols: MessageProtocols;

  #snapshot: BenchSnapshot;
  #version = 0;

  constructor(
    options: EchoExtensionOptions
  ) {
    super();
    this.id = options.roomId ?? ROOM_NAME;
    this.protocols = benchProtocols(options.variants);
    this.#snapshot = snapshotOf(options.snapshotBytes ?? 64);
  }

  override onClientConnect(
    client: ClientHandle,
    _peer: RoomPeer
  ): void {
    client.send({
      type: "snapshot",
      data: this.#snapshot,
      version: this.#version
    });
  }

  override onMessage(
    clientId: string,
    message: BenchCommand,
    context: RoomContext
  ): void {
    this.#version++;
    context.room.broadcast({
      type: "command",
      data: attributeCommand(message, clientId),
      version: this.#version
    });
  }

  override onResync(
    clientId: string,
    context: RoomContext
  ): void {
    context.room.sendTo(clientId, {
      type: "snapshot",
      data: this.#snapshot,
      version: this.#version
    });
  }
}
