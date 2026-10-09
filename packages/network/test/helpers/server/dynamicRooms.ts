// Import Internal Dependencies
import { identityOf } from "./identity.ts";
import {
  Server,
  Extension,
  type ClientHandle,
  type ServerConnection,
  type MessageProtocols,
  type RoomResolution
} from "#src/index.ts";
import { OPAQUE_PROTOCOLS } from "../protocol/protocols.ts";

export class AssetExtension extends Extension {
  readonly id: string;
  readonly name: string;
  readonly protocols: MessageProtocols;
  disposed = 0;
  messages: unknown[] = [];

  constructor(
    id: string,
    name: string,
    protocols: MessageProtocols = OPAQUE_PROTOCOLS
  ) {
    super();
    this.id = id;
    this.name = name;
    this.protocols = protocols;
  }

  override onMessage(
    _clientId: string,
    payload: unknown
  ): void {
    this.messages.push(payload);
  }

  override dispose(): void {
    this.disposed += 1;
  }
}

export function client(
  id: string
): ClientHandle {
  return { id, send: () => void 0 };
}

export interface Harness {
  server: Server;
  created: string[];
  evicted: string[];
  extensions: Map<string, AssetExtension>;
}

export function harness(
  options: { graceMs?: number; kinds?: string[]; } = {}
): Harness {
  const created: string[] = [];
  const evicted: string[] = [];
  const extensions = new Map<string, AssetExtension>();
  const kinds = options.kinds ?? ["pixelart"];

  const server = new Server({
    roomGraceMs: options.graceMs ?? 1_000
  });
  server.setRoomResolver((name): RoomResolution | null => {
    const separator = name.indexOf(":");
    if (separator === -1) {
      return null;
    }

    const kind = name.slice(0, separator);
    const assetId = name.slice(separator + 1);
    if (!kinds.includes(kind) || assetId.length === 0) {
      return null;
    }

    created.push(name);
    const extension = new AssetExtension(name, kind);
    extensions.set(name, extension);

    return {
      extension,
      onEvict: () => {
        evicted.push(name);
      }
    };
  });

  return { server, created, evicted, extensions };
}

export async function join(
  server: Server,
  clientId: string,
  room: string
): Promise<ServerConnection> {
  const connection = server.connect(client(clientId), identityOf(client(clientId)));
  await connection.receive({ room, kind: "join" });

  return connection;
}
