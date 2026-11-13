// Import Node.js Dependencies
import { Console } from "node:console";

// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import {
  CATALOG_ROOM,
  CatalogClient,
  CatalogUnavailableError
} from "@jolly-pixel/asset-server/client";
import {
  DEFAULT_WEBSOCKET_PATH,
  type PeerActivity
} from "@jolly-pixel/network";
import * as network from "@jolly-pixel/network/client";
import { ProjectManifest } from "@jolly-pixel/server";
import { AgentChatClient } from "@jolly-pixel/server/client";

// Import Internal Dependencies
import type { GolemAsset } from "../assets/GolemAsset.ts";
import {
  GOLEM_KINDS,
  isGolemKind,
  openAsset,
  type GolemAssets,
  type GolemKind
} from "../assets/kinds.ts";
import { AssetClosedError } from "../assets/errors/AssetClosedError.ts";
import { KindMismatchError } from "../assets/errors/KindMismatchError.ts";
import { UnsupportedKindError } from "../assets/errors/UnsupportedKindError.ts";
import { ChatChannel } from "../chat/ChatChannel.ts";
import { ActivityMirror } from "./ActivityMirror.ts";
import {
  golemTarget,
  type GolemConnectOptions
} from "./GolemConnectOptions.ts";
import { GolemTokenRefusedError } from "./errors/GolemTokenRefusedError.ts";
import { StudioUnreachableError } from "./errors/StudioUnreachableError.ts";
import { UnknownAssetError } from "./errors/UnknownAssetError.ts";
import {
  OpenAssets,
  type AssetHolder
} from "./OpenAssets.ts";

// CONSTANTS
const kAgent = Symbol("agent");

export interface StudioStatus {
  url: string;
  role: string;
  peers: StudioPeer[];
  assets: OpenAssetStatus[];
  unreadChat: number;
}

export interface StudioPeer {
  name: string;
  role: string;
  via?: string;
}

export interface OpenAssetStatus {
  assetId: string;
  kind: string;
  unanswered: number;
  peers: StudioPeer[];
}

export type GolemKindFilter<TKind extends GolemKind> = TKind | readonly TKind[];

interface GolemConnection {
  url: string;
  client: network.Client;
  catalog: CatalogClient;
  manifest: ProjectManifest;
  agentChat: AgentChatClient;
  revoked: AbortSignal;
}

export class Golem {
  static async connect(
    options: GolemConnectOptions = {}
  ): Promise<Golem> {
    const {
      url,
      token,
      timeoutMs
    } = golemTarget(options);
    const socketUrl = studioSocketUrl(url);
    const client = new network.Client({
      logger: network.consoleLogger(new Console({
        stdout: process.stderr
      })),
      socket: () => network.connectWebSocket({
        url: socketUrl,
        credential: token
      })
    });
    const revoked = new AbortController();
    client.on("unauthorized", () => {
      revoked.abort(new GolemTokenRefusedError());
    });
    const agentChat = AgentChatClient.join(client);
    try {
      const [catalog, manifest] = await Promise.all([
        CatalogClient.connect(client, {
          timeoutMs,
          signal: revoked.signal
        }),
        ProjectManifest.fetch(url).catch((error: unknown) => {
          throw new StudioUnreachableError(url.href, { cause: error });
        })
      ]);

      return new Golem({
        url: url.href,
        client,
        catalog,
        manifest,
        agentChat,
        revoked: revoked.signal
      });
    }
    catch (error) {
      agentChat.dispose();
      client.destroy();
      if (error instanceof CatalogUnavailableError) {
        throw new StudioUnreachableError(url.href, { cause: error });
      }

      throw error;
    }
  }

  readonly url: string;
  readonly catalog: CatalogClient;
  readonly chat: ChatChannel;

  #client: network.Client;
  #manifest: ProjectManifest;
  #revoked: AbortSignal;
  #opened = new OpenAssets();
  #activity: ActivityMirror;

  constructor(
    connection: GolemConnection
  ) {
    this.url = connection.url;
    this.#client = connection.client;
    this.catalog = connection.catalog;
    this.#manifest = connection.manifest;
    this.chat = new ChatChannel(connection.agentChat);
    this.#revoked = connection.revoked;
    this.#activity = new ActivityMirror(
      connection.agentChat,
      (asset) => this.#room(asset.kind, asset.id)
    );
  }

  get role(): string {
    return this.#client.room(CATALOG_ROOM).role;
  }

  peers(): IterableIterator<network.Peer> {
    return this.#client.room(CATALOG_ROOM).peers.values();
  }

  assets(): IterableIterator<GolemAsset> {
    return this.#opened.values();
  }

  status(): StudioStatus {
    return {
      url: this.url,
      role: this.role,
      peers: Array.from(this.peers(), studioPeer),
      assets: Array.from(this.assets(), (asset) => {
        return {
          assetId: asset.id,
          kind: asset.kind,
          unanswered: asset.unanswered,
          peers: Array.from(asset.peers(), studioPeer)
        };
      }),
      unreadChat: this.chat.unread
    };
  }

  open<TKind extends GolemKind = GolemKind>(
    assetId: string,
    kind?: GolemKindFilter<TKind>
  ): Promise<GolemAssets[TKind]> {
    return this.#hold(assetId, kind, kAgent);
  }

  close(
    assetId: string
  ): void {
    if (!this.#opened.holds(assetId, kAgent)) {
      throw new AssetClosedError(assetId);
    }

    this.#opened.release(assetId, kAgent);
  }

  activity(
    asset: GolemAsset,
    activity: PeerActivity
  ): void {
    if (this.#opened.get(asset.id) !== asset) {
      throw new AssetClosedError(asset.id);
    }
    this.#activity.show(asset, activity);
  }

  clearActivity(): void {
    this.#activity.clear();
  }

  dispose(): void {
    for (const asset of [...this.assets()]) {
      asset.close();
    }
    this.catalog.dispose();
    this.chat.dispose();
    this.#client.destroy();
  }

  [Symbol.dispose](): void {
    this.dispose();
  }

  #room(
    kind: string,
    assetId: string
  ): network.Room {
    return this.#client.room(new AssetRoom(kind, assetId).toString());
  }

  async #hold<TKind extends GolemKind>(
    assetId: string,
    kind: GolemKindFilter<TKind> | undefined,
    holder: AssetHolder
  ): Promise<GolemAssets[TKind]> {
    const record = this.catalog.record(assetId);
    if (record === undefined) {
      throw new UnknownAssetError(assetId);
    }
    const expected: readonly string[] | null = kind === undefined ?
      null :
      [kind].flat();
    if (expected !== null && !expected.includes(record.kind)) {
      throw new KindMismatchError(assetId, record.kind, expected);
    }
    if (!isGolemKind(record.kind)) {
      throw new UnsupportedKindError(record.kind, GOLEM_KINDS);
    }

    const recordKind = record.kind;
    const asset = this.#opened.hold(
      assetId,
      holder,
      () => this.#join(assetId, recordKind)
    );
    try {
      await asset.ready;
    }
    catch (error) {
      asset.close();

      throw error;
    }

    return asset as GolemAssets[TKind];
  }

  #join(
    assetId: string,
    kind: GolemKind
  ): GolemAsset {
    const asset = openAsset(kind, {
      assetId,
      room: this.#room(kind, assetId),
      catalog: this.catalog,
      manifest: this.#manifest,
      signal: this.#revoked,
      onClose: () => this.#forget(asset),
      open: (otherId, otherKind) => this.#hold(otherId, otherKind, assetId)
    });

    return asset;
  }

  #forget(
    asset: GolemAsset
  ): void {
    this.#activity.forget(asset);
    this.#opened.forget(asset);
  }
}

function studioSocketUrl(
  studioUrl: URL
): string {
  const url = new URL(DEFAULT_WEBSOCKET_PATH, studioUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";

  return url.href;
}

function studioPeer(
  peer: network.Peer
): StudioPeer {
  const { username, via } = network.parsePeerProfile(peer.profile);

  return {
    name: username,
    role: peer.role,
    via
  };
}
