// Import Third-party Dependencies
import { AssetRoom } from "@jolly-pixel/asset";
import {
  CATALOG_ROOM,
  CatalogClient,
  CatalogUnavailableError
} from "@jolly-pixel/asset-server/client";
import {
  AssetClosedError,
  KindMismatchError,
  UnknownAssetError,
  type GolemAsset,
  type GolemAssets,
  type GolemKindName
} from "@jolly-pixel/golem.kit";
import type { PeerActivity } from "@jolly-pixel/network";
import * as network from "@jolly-pixel/network/client";
import {
  ProjectManifest,
  openAssets,
  type OpenAssets as OpenAssetsPresence
} from "@jolly-pixel/server";
import {
  AgentChatClient,
  openAssetsChannel
} from "@jolly-pixel/server/client";

// Import Internal Dependencies
import {
  GolemKinds,
  type AnyGolemKind
} from "../kinds/GolemKinds.ts";
import { ChatChannel } from "../chat/ChatChannel.ts";
import { ActivityMirror } from "./ActivityMirror.ts";
import {
  golemTarget,
  type GolemConnectOptions
} from "./GolemConnectOptions.ts";
import { StudioUnreachableError } from "./errors/StudioUnreachableError.ts";
import { studioClient } from "./studioClient.ts";
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

export type GolemKindFilter<TKind extends string> = TKind | readonly TKind[];

interface GolemConnection {
  url: string;
  client: network.Client;
  catalog: CatalogClient;
  manifest: ProjectManifest;
  kinds: GolemKinds;
  agentChat: AgentChatClient;
  revoked: AbortSignal;
}

export class Golem {
  static async connect(
    options: GolemConnectOptions = {}
  ): Promise<Golem> {
    const target = golemTarget(options);
    const { url, projectRoot } = target;
    const { client, revoked } = studioClient(target);
    const agentChat = AgentChatClient.join(client);
    try {
      const [catalog, manifest] = await Promise.all([
        CatalogClient.connect(client, {
          timeoutMs: target.timeoutMs,
          signal: revoked
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
        kinds: await GolemKinds.load(manifest.kindPackages, projectRoot),
        agentChat,
        revoked
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
  readonly kinds: GolemKinds;
  readonly chat: ChatChannel;

  #client: network.Client;
  #presence: network.PresenceChannel<OpenAssetsPresence>;
  #manifest: ProjectManifest;
  #revoked: AbortSignal;
  #opened = new OpenAssets(() => this.#publishOpenAssets());
  #activity: ActivityMirror;

  constructor(
    connection: GolemConnection
  ) {
    this.url = connection.url;
    this.#client = connection.client;
    this.#presence = openAssetsChannel(connection.client.room(CATALOG_ROOM));
    this.catalog = connection.catalog;
    this.kinds = connection.kinds;
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

  open<TKind extends GolemKindName>(
    assetId: string,
    kind: GolemKindFilter<TKind>
  ): Promise<GolemAssets[TKind]>;
  open(
    assetId: string,
    kind?: GolemKindFilter<string>
  ): Promise<GolemAsset>;
  open(
    assetId: string,
    kind?: GolemKindFilter<string>
  ): Promise<GolemAsset> {
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
    this.#publishOpenAssets();
  }

  clearActivity(): void {
    this.#activity.clear();
    this.#publishOpenAssets();
  }

  dispose(): void {
    for (const asset of [...this.assets()]) {
      asset.close();
    }
    this.#presence.destroy();
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

  async #hold(
    assetId: string,
    kind: GolemKindFilter<string> | undefined,
    holder: AssetHolder
  ): Promise<GolemAsset> {
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
    const contribution = this.kinds.contribution(record.kind);

    const asset = this.#opened.hold(
      assetId,
      holder,
      () => this.#join(assetId, contribution)
    );
    try {
      await asset.ready;
    }
    catch (error) {
      asset.close();

      throw error;
    }

    return asset;
  }

  #join(
    assetId: string,
    contribution: AnyGolemKind
  ): GolemAsset {
    const asset = contribution.open({
      assetId,
      room: this.#room(contribution.kind, assetId),
      signal: this.#revoked,
      onClose: () => this.#forget(asset),
      studio: {
        catalog: this.catalog,
        editors: this.#manifest.editors,
        open: <TKind extends GolemKindName>(otherId: string, otherKind: TKind) => (
          this.#hold(otherId, otherKind, assetId) as Promise<GolemAssets[TKind]>
        )
      }
    });

    return asset;
  }

  #forget(
    asset: GolemAsset
  ): void {
    this.#activity.forget(asset);
    this.#opened.forget(asset);
  }

  #publishOpenAssets(): void {
    this.#presence.publish(
      openAssets(this.#opened.heldBy(kAgent), this.#activity.assetId)
    );
  }
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
