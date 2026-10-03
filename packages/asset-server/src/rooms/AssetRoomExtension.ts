// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetRoomBinding
} from "../kinds/AssetKindHandler.ts";
import {
  ASSET_ROOM_DELETED,
  ASSET_ROOM_REJECTED,
  type AssetCommandHeader,
  type AssetLiveProtocol,
  type AssetRoomDeletedMessage,
  type AssetRoomRejectedMessage
} from "../kinds/AssetLiveProtocol.ts";
import {
  actorOf,
  isStateNeutral
} from "../events/AssetEvents.ts";
import type { RecordedCommand } from "../state/AssetStateStore.ts";
import {
  assetRoomDeletedSchema,
  assetRoomRejectedSchema
} from "./AssetRoomExtension.schema.ts";
import {
  PeerAcks,
  type AcksField
} from "./PeerAcks.ts";
import { SnapshotCache } from "./SnapshotCache.ts";

// CONSTANTS
const kDefaultResumeLimit = 1_000;
const kDefaultDepartureTimeout = 5_000;
const kResumeParser = new network.SchemaParser(network.defineSchema({
  type: "object",
  properties: {
    clientId: { type: "string" },
    version: {
      type: "integer",
      minimum: 0
    }
  },
  required: ["clientId"]
}));
const kRoomProtocols = new WeakMap<
  network.MessageProtocol,
  Map<network.JSONSchema, network.MessageProtocols>
>();

export interface AssetRoomExtensionOptions<TCommand = unknown> {
  reader?: EventStore.EventReader;
  restore?: Iterable<RecordedCommand<TCommand>>;
  resumeLimit?: number;
  departureTimeout?: number;
}

type AssetSyncMessage = network.NetworkSyncMessage<unknown, unknown>;

interface CatchUp {
  readonly commands: unknown[];
  readonly version: number;
}

export class AssetRoomExtension<
  TCommand extends AssetCommandHeader = AssetCommandHeader
> extends network.Extension<TCommand> {
  readonly id: string;
  readonly name: string;
  readonly protocols: network.MessageProtocols;

  #assetId: string;
  #version: () => number | undefined;
  #commands: AssetCommands<unknown, TCommand>;
  #protocol: AssetLiveProtocol<TCommand>;
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

  constructor(
    binding: AssetRoomBinding,
    commands: AssetCommands<unknown, TCommand>,
    protocol: AssetLiveProtocol<TCommand>,
    events: EventStore.EventWriter,
    options: AssetRoomExtensionOptions<TCommand> = {}
  ) {
    super();

    this.id = binding.roomId;
    this.name = binding.kind;
    this.protocols = assetRoomProtocols(
      commands.protocol,
      protocol.snapshotSchema
    );
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

  override async onClientConnect(
    client: network.ClientHandle,
    peer: network.RoomPeer,
    context: network.RoomContext
  ): Promise<void> {
    this.#room = context.room;
    this.#members.add(peer.clientId);

    const resume = kResumeParser.parse(peer.resume);
    if (resume.ok) {
      await this.#departure(resume.val.clientId);
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
      resume.ok ? this.#resumeMessage(resume.val) : this.#snapshot({})
    );
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
      this.#snapshot(this.#acks.of([clientId]))
    );
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    this.#acks.depart(clientId);
    this.#departures.get(clientId)?.();
  }

  override onMessage(
    clientId: string,
    message: TCommand,
    context: network.RoomContext
  ): void {
    if (this.#deleted) {
      return;
    }

    const command = withAuthor(message, clientId);
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
      actor: actorOf(context.identity)
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
    context.room.broadcast(
      this.#broadcastOf(
        arbitration.command,
        appended.val.eventVersion
      )
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
    if (events.length > 0 && events[0].eventVersion !== from + 1) {
      return null;
    }

    const commands: unknown[] = [];
    for (const event of events) {
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
    const { data, version } = this.#snapshots.current();

    return {
      type: "snapshot",
      data,
      ...(version === undefined ? {} : { version }),
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
    const acks = this.#acks.of([clientId]);
    if (correction !== null) {
      room.sendTo(clientId, {
        type: "correction",
        data: correction,
        ...acks
      } satisfies AssetSyncMessage);

      return;
    }

    room.sendTo(clientId, this.#snapshot(acks));
  }

  #broadcastOf(
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

function withAuthor<TCommand extends AssetCommandHeader>(
  command: TCommand,
  clientId: string
): TCommand {
  if (typeof command.timestamp === "number") {
    return {
      ...command,
      clientId,
      timestamp: Math.min(command.timestamp, Date.now())
    };
  }

  return {
    ...command,
    clientId
  };
}

function assetRoomProtocols(
  command: network.MessageProtocol,
  snapshot: network.JSONSchema
): network.MessageProtocols {
  let bySnapshot = kRoomProtocols.get(command);
  if (bySnapshot === undefined) {
    bySnapshot = new Map();
    kRoomProtocols.set(command, bySnapshot);
  }

  let protocols = bySnapshot.get(snapshot);
  if (protocols === undefined) {
    protocols = {
      inbound: command,
      outbound: network.serverMessageProtocol({
        command,
        snapshot,
        notices: [
          assetRoomDeletedSchema,
          assetRoomRejectedSchema
        ]
      })
    };
    bySnapshot.set(snapshot, protocols);
  }

  return protocols;
}
