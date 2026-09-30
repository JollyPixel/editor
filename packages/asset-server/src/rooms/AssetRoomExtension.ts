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
  type AssetLiveProtocol,
  type AssetRoomMessage,
  type AssetRoomDeletedMessage,
  type AssetRoomRejectedMessage
} from "../kinds/AssetLiveProtocol.ts";
import { parseAssetCommand } from "../kinds/parseAssetCommand.ts";
import {
  actorOf,
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_RENAMED
} from "../events/AssetEvents.ts";
import { isScheduledSnapshot } from "../state/SnapshotScheduler.ts";
import {
  assetRoomDeletedSchema,
  assetRoomRejectedSchema
} from "./AssetRoomExtension.schema.ts";

// CONSTANTS
const kDefaultResumeLimit = 1_000;
const kDefaultDepartureTimeout = 5_000;
const kMaxDeparted = 256;

export interface AssetRoomExtensionOptions {
  reader?: EventStore.EventReader;
  resumeLimit?: number;
  departureTimeout?: number;
}

type SyncExtras = {
  version?: number;
  acks?: network.NetworkAcks;
};

interface CatchUp {
  readonly commands: unknown[];
  readonly version: number;
}

export class AssetRoomExtension<
  TCommand = unknown
> extends network.Extension {
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
  #members = new Set<string>();
  #departures = new Map<string, () => void>();
  #processed = new Map<string, number>();
  #departed = new Map<string, number>();

  constructor(
    binding: AssetRoomBinding,
    commands: AssetCommands<unknown, TCommand>,
    protocol: AssetLiveProtocol<TCommand>,
    events: EventStore.EventWriter,
    options: AssetRoomExtensionOptions = {}
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
    this.#restore();
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

    const resume = resumeOf(peer.resume);
    if (resume !== null) {
      await this.#departure(resume.clientId);
    }

    if (this.#deleted) {
      client.send({
        type: ASSET_ROOM_DELETED
      } satisfies AssetRoomDeletedMessage);

      return;
    }

    client.send(this.#joinMessage(resume));
  }

  override onResync(
    clientId: string,
    context: network.RoomContext
  ): void {
    if (this.#deleted) {
      return;
    }

    context.room.sendTo(clientId, this.#snapshot(this.#acksOf([clientId])));
  }

  override onClientDisconnect(
    clientId: string
  ): void {
    this.#members.delete(clientId);
    const seq = this.#processed.get(clientId);
    if (seq !== undefined) {
      this.#processed.delete(clientId);
      this.#departed.set(clientId, seq);
      if (this.#departed.size > kMaxDeparted) {
        this.#departed.delete(this.#departed.keys().next().value!);
      }
    }
    this.#departures.get(clientId)?.();
  }

  override onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void {
    if (this.#deleted) {
      return;
    }

    const command = parseAssetCommand(
      this.#commands,
      withAuthor(payload, clientId)
    );
    if (command === null) {
      return;
    }
    const seq = seqOf(command);
    if (seq !== undefined) {
      this.#processed.set(clientId, seq);
    }

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
      this.#broadcastOf(arbitration.command, appended.val.eventVersion)
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

  #restore(): void {
    if (this.#reader === null || this.#protocol.restore === undefined) {
      return;
    }

    const events = this.#reader.listFromCheckpoint(
      this.#assetId,
      ASSET_CHECKPOINT_EVENT_TYPES
    );
    for (const event of events) {
      if (event.eventType !== this.#commands.eventType) {
        continue;
      }

      const command = parseAssetCommand(this.#commands, event.eventData);
      if (command !== null) {
        this.#protocol.restore(command, event.eventVersion);
      }
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

  #joinMessage(
    resume: network.NetworkResume | null
  ): AssetRoomMessage & SyncExtras {
    if (resume === null) {
      return this.#snapshot({});
    }

    const seq = this.#processed.get(resume.clientId) ??
      this.#departed.get(resume.clientId);
    const acks = seq === undefined ?
      {} :
      { acks: { [resume.clientId]: seq } };
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
      else if (
        event.eventType !== ASSET_RENAMED &&
        !isScheduledSnapshot(event)
      ) {
        return null;
      }
    }

    return {
      commands,
      version: events.at(-1)?.eventVersion ?? from
    };
  }

  #snapshot(
    extras: SyncExtras
  ): AssetRoomMessage & SyncExtras {
    const version = this.#version();

    return {
      type: "snapshot",
      data: this.#protocol.snapshot(),
      ...(version === undefined ? {} : { version }),
      ...extras
    };
  }

  #resync(
    clientId: string,
    room: network.RoomBroadcast,
    command: TCommand,
    admitted: TCommand | null
  ): void {
    const correction = this.#protocol.correct?.(command, admitted) ?? null;
    const acks = this.#acksOf([clientId]);
    if (correction !== null) {
      room.sendTo(clientId, {
        type: "correction",
        data: correction,
        ...acks
      });

      return;
    }

    room.sendTo(clientId, this.#snapshot(acks));
  }

  #broadcastOf(
    command: TCommand,
    version: number
  ): AssetRoomMessage & SyncExtras {
    const message = this.#protocol.broadcast?.(command) ?? {
      type: "command",
      data: command
    };
    switch (message.type) {
      case "command":
        return {
          ...message,
          version
        };
      case "snapshot":
        return {
          ...message,
          version,
          ...this.#acksOf(this.#processed.keys())
        };
      default:
        return message;
    }
  }

  #acksOf(
    clientIds: Iterable<string>
  ): { acks?: network.NetworkAcks; } {
    const acks: network.NetworkAcks = {};
    for (const clientId of clientIds) {
      const seq = this.#processed.get(clientId);
      if (seq !== undefined) {
        acks[clientId] = seq;
      }
    }

    return Object.keys(acks).length === 0 ? {} : { acks };
  }
}

function resumeOf(
  value: unknown
): network.NetworkResume | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("clientId" in value) ||
    typeof value.clientId !== "string"
  ) {
    return null;
  }
  if (
    "version" in value &&
    typeof value.version === "number" &&
    Number.isInteger(value.version)
  ) {
    return {
      clientId: value.clientId,
      version: value.version
    };
  }

  return {
    clientId: value.clientId
  };
}

function seqOf(
  command: unknown
): number | undefined {
  if (
    typeof command === "object" &&
    command !== null &&
    "seq" in command &&
    typeof command.seq === "number"
  ) {
    return command.seq;
  }

  return undefined;
}

function withAuthor(
  payload: unknown,
  clientId: string
): unknown {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return payload;
  }

  if (
    "timestamp" in payload &&
    typeof payload.timestamp === "number"
  ) {
    return {
      ...payload,
      clientId,
      timestamp: Math.min(payload.timestamp, Date.now())
    };
  }

  return {
    ...payload,
    clientId
  };
}

function assetRoomProtocols(
  command: network.MessageProtocol,
  snapshot: network.JSONSchema
): network.MessageProtocols {
  return {
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
}
