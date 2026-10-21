// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetRoomBinding
} from "../model/kinds/AssetKindHandler.ts";
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_PARTS,
  ASSET_ROOM_REJECTED,
  ASSET_ROOM_SUBSCRIBE_PARTS,
  type AssetCommandHeader,
  type AssetLiveParts,
  type AssetLiveProtocol,
  type AssetPartsRequest,
  type AssetRoomDeletedMessage,
  type AssetRoomPartsMessage,
  type AssetRoomRejectedMessage
} from "../model/kinds/AssetLiveProtocol.ts";
import {
  toActor,
  isStateNeutral
} from "../model/events/AssetEvents.ts";
import type { RecordedCommand } from "./AssetStateStore.ts";
import { assetRoomResumeSchema } from "./AssetRoomExtension.schema.ts";
import { AssetRoomProtocols } from "./AssetRoomProtocols.ts";
import { attributeCommand } from "./attributeCommand.ts";
import {
  PeerAcks,
  type AcksField
} from "./PeerAcks.ts";
import { SnapshotCache } from "./SnapshotCache.ts";

// CONSTANTS
const kDefaultResumeLimit = 1_000;
const kDefaultDepartureTimeout = 5_000;
const kResumeParser = new network.SchemaParser(assetRoomResumeSchema);

export interface AssetRoomExtensionOptions<TCommand = unknown> {
  reader?: EventStore.EventReader;
  restore?: Iterable<RecordedCommand<TCommand>>;
  resumeLimit?: number;
  departureTimeout?: number;
  /**
   * The parts of the room's kind. The live protocol then declares `parts`.
   */
  parts?: AssetRoomParts<TCommand>;
  /**
   * Sends every part after the snapshot of a joining member, for a room that
   * accepts no subscription.
   */
  pushParts?: boolean;
}

export interface AssetRoomParts<TCommand = unknown> {
  touched(
    command: TCommand
  ): Iterable<string>;

  list(): Iterable<string>;
}

interface RoomParts<TCommand extends AssetCommandHeader> {
  readonly kind: AssetRoomParts<TCommand>;
  readonly live: AssetLiveParts<TCommand>;
  readonly subscriptions: Map<string, Set<string>>;
}

type AssetSyncMessage = network.NetworkSyncMessage<unknown, unknown>;

interface CatchUp {
  readonly commands: unknown[];
  readonly version: number;
}

export class AssetRoomExtension<
  TCommand extends AssetCommandHeader = AssetCommandHeader,
  TRelay extends object = never
> extends network.Extension<TCommand | TRelay> {
  readonly id: string;
  readonly name: string;
  readonly protocols: network.MessageProtocols;

  #assetId: string;
  #version: () => number | undefined;
  #commands: AssetCommands<unknown, TCommand, TRelay>;
  #protocol: AssetLiveProtocol<TCommand, TRelay>;
  #roomProtocols: AssetRoomProtocols<TCommand, TRelay>;
  #events: EventStore.EventWriter;
  #reader: EventStore.EventReader | null;
  #resumeLimit: number;
  #departureTimeout: number;
  #room: network.RoomBroadcast | null = null;
  #deleted = false;
  #snapshots: SnapshotCache;
  #acks = new PeerAcks();
  #members = new Set<string>();
  #departures = new Map<string, () => void>();
  #parts: RoomParts<TCommand> | null;
  #pushParts: boolean;

  constructor(
    binding: AssetRoomBinding,
    commands: AssetCommands<unknown, TCommand, TRelay>,
    protocol: AssetLiveProtocol<TCommand, TRelay>,
    events: EventStore.EventWriter,
    options: AssetRoomExtensionOptions<TCommand> = {}
  ) {
    super();
    if ((options.parts === undefined) !== (protocol.parts === undefined)) {
      throw new TypeError(
        options.parts === undefined ?
          `Asset kind "${binding.kind}" has a live().parts but declares no parts.` :
          `Asset kind "${binding.kind}" declares parts but has no live().parts.`
      );
    }
    if ((commands.relay === undefined) !== (protocol.relay === undefined)) {
      throw new TypeError(
        commands.relay === undefined ?
          `Asset kind "${binding.kind}" has a live().relay but no commands.relay schemas.` :
          `Asset kind "${binding.kind}" has commands.relay schemas but no live().relay.`
      );
    }

    this.id = binding.roomId;
    this.name = binding.kind;
    this.#roomProtocols = AssetRoomProtocols.compile(
      commands,
      protocol.parts !== undefined
    );
    this.protocols = this.#roomProtocols.withSnapshot(
      protocol.snapshotSchema,
      protocol.parts?.schema
    );
    this.#parts = options.parts === undefined || protocol.parts === undefined ?
      null :
      {
        kind: options.parts,
        live: protocol.parts,
        subscriptions: new Map()
      };
    this.#pushParts = options.pushParts ?? false;
    this.#assetId = binding.assetId;
    this.#version = binding.version ?? (() => undefined);
    this.#commands = commands;
    this.#protocol = protocol;
    this.#events = events;
    this.#reader = options.reader ?? null;
    this.#resumeLimit = options.resumeLimit ?? kDefaultResumeLimit;
    this.#departureTimeout = options.departureTimeout ??
      kDefaultDepartureTimeout;
    this.#snapshots = new SnapshotCache(protocol, this.#version);
    this.#restore(options.restore ?? []);
  }

  get deleted(): boolean {
    return this.#deleted;
  }

  markDeleted(): void {
    if (this.#deleted) {
      return;
    }

    this.#deleted = true;
    this.#room?.broadcast({
      type: ASSET_ROOM_DELETED
    } satisfies AssetRoomDeletedMessage);
  }

  reload(): void {
    if (this.#deleted) {
      return;
    }

    const room = this.#room;
    if (room === null) {
      return;
    }

    room.broadcast(
      this.#snapshot(this.#acks.ofEveryone())
    );
    for (const clientId of this.#parts?.subscriptions.keys() ?? []) {
      this.#sendSubscribedParts(clientId, room);
    }
  }

  override async onClientConnect(
    client: network.ClientHandle,
    peer: network.RoomPeer,
    context: network.RoomContext
  ): Promise<void> {
    this.#room = context.room;
    this.#members.add(peer.clientId);

    const resume = peer.resume === undefined ?
      null :
      kResumeParser.parse(peer.resume).unwrapOr(null);
    if (resume !== null) {
      await this.#departure(resume.clientId);
    }
    const encoding = this.#snapshots.refresh();
    if (encoding !== null) {
      await encoding;
    }

    if (this.#deleted) {
      client.send({
        type: ASSET_ROOM_DELETED
      } satisfies AssetRoomDeletedMessage);

      return;
    }

    client.send(
      resume === null ? this.#snapshot({}) : this.#resumeMessage(resume)
    );
    if (this.#pushParts && this.#parts !== null) {
      client.send(this.#partsMessage(this.#parts.kind.list()));
    }
  }

  override onResync(
    clientId: string,
    context: network.RoomContext
  ): void {
    if (this.#deleted) {
      return;
    }

    context.room.sendTo(
      clientId,
      this.#snapshot(this.#acks.collectAcks([clientId]))
    );
    this.#sendSubscribedParts(clientId, context.room);
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    this.#parts?.subscriptions.delete(clientId);
    this.#acks.depart(clientId);
    this.#protocol.relay?.leave?.(clientId);
    this.#departures.get(clientId)?.();
  }

  override onMessage(
    clientId: string,
    message: TCommand | TRelay,
    context: network.RoomContext
  ): void {
    if (this.#deleted) {
      return;
    }
    if (this.#roomProtocols.routesToRelay(message)) {
      this.#protocol.relay?.receive(clientId, message, context.room);

      return;
    }

    const request = this.#roomProtocols.partRequest(message);
    if (request !== null) {
      this.#requestParts(clientId, request, context.room);

      return;
    }

    const command = attributeCommand(message, clientId);
    this.#acks.record(clientId, command.seq);

    const arbitration = this.#protocol.arbitrate(command);
    if (arbitration === null) {
      this.#resync(
        clientId,
        context.room,
        command,
        null
      );

      return;
    }

    const appended = this.#events.append({
      assetType: this.name,
      assetId: this.#assetId,
      eventType: this.#commands.eventType,
      eventData: arbitration.command,
      actor: toActor(context.identity)
    });
    if (!appended.ok) {
      context.room.sendTo(clientId, {
        type: ASSET_ROOM_REJECTED,
        reason: appended.val.message
      } satisfies AssetRoomRejectedMessage);
      this.#resync(
        clientId,
        context.room,
        command,
        null
      );

      return;
    }

    arbitration.commit?.(appended.val.eventVersion);
    this.#broadcast(
      clientId,
      context.room,
      arbitration.command,
      appended.val.eventVersion
    );
    if (arbitration.command !== command) {
      this.#resync(
        clientId,
        context.room,
        command,
        arbitration.command
      );
    }
  }

  #restore(
    commands: Iterable<RecordedCommand<TCommand>>
  ): void {
    if (this.#protocol.restore === undefined) {
      return;
    }

    for (const { command, version } of commands) {
      this.#protocol.restore(command, version);
    }
  }

  #departure(
    clientId: string
  ): Promise<void> {
    if (!this.#members.has(clientId)) {
      return Promise.resolve();
    }

    const { promise, resolve } = Promise.withResolvers<void>();
    const departures = this.#departures;
    const timer = setTimeout(done, this.#departureTimeout);
    function done(): void {
      clearTimeout(timer);
      departures.delete(clientId);
      resolve();
    }
    departures.set(clientId, done);

    return promise;
  }

  #resumeMessage(
    resume: network.NetworkResume
  ): AssetSyncMessage {
    const acks = this.#acks.resumedBy(resume.clientId);
    const caughtUp = this.#catchUp(resume.version);
    if (caughtUp === null) {
      return this.#snapshot(acks);
    }

    return {
      type: "catch-up",
      data: caughtUp.commands,
      version: caughtUp.version,
      ...acks
    };
  }

  #catchUp(
    from: number | undefined
  ): CatchUp | null {
    const current = this.#version();
    if (
      from === undefined ||
      this.#reader === null ||
      current === undefined ||
      from > current ||
      current - from > this.#resumeLimit
    ) {
      return null;
    }

    const events = this.#reader.list(this.#assetId, from);
    const commands: unknown[] = [];
    let expectedVersion = from + 1;
    for (const event of events) {
      if (event.eventVersion !== expectedVersion++) {
        return null;
      }

      if (event.eventType === this.#commands.eventType) {
        commands.push(event.eventData);
      }
      else if (!isStateNeutral(event)) {
        return null;
      }
    }

    return {
      commands,
      version: events.at(-1)?.eventVersion ?? from
    };
  }

  #snapshot(
    acks: AcksField
  ): AssetSyncMessage {
    const message = this.#snapshots.current();

    return acks.acks === undefined ?
      message :
      {
        ...message,
        ...acks
      };
  }

  #resync(
    clientId: string,
    room: network.RoomBroadcast,
    command: TCommand,
    admitted: TCommand | null
  ): void {
    const correction = this.#protocol.correct?.(
      command,
      admitted
    ) ?? null;
    const acks = this.#acks.collectAcks([clientId]);
    const refused = admitted === null && typeof command.seq === "number" ?
      { refused: command.seq } :
      {};
    if (correction !== null) {
      room.sendTo(clientId, {
        type: "correction",
        data: correction,
        ...acks,
        ...refused
      } satisfies AssetSyncMessage);

      return;
    }

    room.sendTo(clientId, {
      ...this.#snapshot(acks),
      ...refused
    });
    this.#sendSubscribedParts(clientId, room);
  }

  #requestParts(
    clientId: string,
    request: AssetPartsRequest,
    room: network.RoomBroadcast
  ): void {
    if (this.#parts === null) {
      return;
    }

    const { subscriptions } = this.#parts;
    const subscribed = subscriptions.get(clientId) ?? new Set<string>();
    if (request.action !== ASSET_ROOM_SUBSCRIBE_PARTS) {
      for (const partId of request.parts) {
        subscribed.delete(partId);
      }

      return;
    }

    for (const partId of request.parts) {
      subscribed.add(partId);
    }
    subscriptions.set(clientId, subscribed);
    this.#sendParts(clientId, room, request.parts);
  }

  #sendSubscribedParts(
    clientId: string,
    room: network.RoomBroadcast
  ): void {
    const subscribed = this.#parts?.subscriptions.get(clientId);
    if (subscribed !== undefined && subscribed.size > 0) {
      this.#sendParts(clientId, room, subscribed);
    }
  }

  #sendParts(
    clientId: string,
    room: network.RoomBroadcast,
    partIds: Iterable<string>
  ): void {
    if (this.#parts !== null) {
      room.sendTo(clientId, this.#partsMessage(partIds));
    }
  }

  #partsMessage(
    partIds: Iterable<string>
  ): AssetRoomPartsMessage {
    const parts: Record<string, unknown> = {};
    for (const partId of partIds) {
      parts[partId] = this.#parts?.live.part(partId) ?? null;
    }

    return {
      type: ASSET_ROOM_PARTS,
      version: this.#version() ?? 0,
      parts
    };
  }

  #broadcast(
    authorId: string,
    room: network.RoomBroadcast,
    command: TCommand,
    version: number
  ): void {
    const message = this.#toBroadcast(command, version);
    const parts = this.#parts;
    if (parts === null || message.type !== "command") {
      room.broadcast(message);

      return;
    }

    const touched = [...parts.kind.touched(command)];
    const outside = parts.live.outside?.(command) ?? null;
    for (const clientId of this.#members) {
      const subscribed = parts.subscriptions.get(clientId);
      if (
        clientId === authorId ||
        touched.some((partId) => subscribed?.has(partId) === true)
      ) {
        room.sendTo(clientId, message);
      }
      else if (outside !== null) {
        room.sendTo(clientId, {
          type: "command",
          data: outside,
          version
        });
      }
    }
  }

  #toBroadcast(
    command: TCommand,
    version: number
  ): AssetSyncMessage {
    const message = this.#protocol.broadcast?.(command) ?? {
      type: "command",
      data: command
    };

    return message.type === "command" ?
      {
        ...message,
        version
      } :
      {
        ...message,
        version,
        ...this.#acks.ofEveryone()
      };
  }
}
