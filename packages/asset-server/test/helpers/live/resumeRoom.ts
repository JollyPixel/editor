// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Ok } from "@openally/result";

// Import Internal Dependencies
import {
  AssetRoomExtension,
  type AssetRoomExtensionOptions
} from "#src/index.ts";
import { counterSnapshotSchema } from "../protocols.ts";
import {
  COUNTER_ROOM_ASSET_ID,
  counterRoomBinding,
  counterRoomCommands,
  recordingClient,
  recordingRoom,
  roomPeer
} from "../rooms.ts";

export interface ResumeCommand {
  action: string;
  clientId?: string;
  seq?: number;
}

export function resumeRoom(
  options: AssetRoomExtensionOptions<ResumeCommand> = {}
) {
  let log: EventStore.Event[] = [];
  let head = 0;
  function record(
    input: Omit<EventStore.AppendInput, "assetId" | "assetType">
  ): EventStore.Event {
    head++;
    const event: EventStore.Event = {
      ...input,
      assetId: COUNTER_ROOM_ASSET_ID,
      assetType: "counter",
      eventId: head,
      eventVersion: head,
      createdAt: ""
    };
    log.push(event);

    return event;
  }
  function compact(
    fromVersion: number,
    toVersion: number
  ): void {
    log = log.filter(
      (event) => event.eventVersion < fromVersion ||
        event.eventVersion > toVersion
    );
  }

  const extension = new AssetRoomExtension<ResumeCommand>(
    counterRoomBinding({ version: () => head }),
    counterRoomCommands<ResumeCommand>(),
    {
      snapshotSchema: counterSnapshotSchema,
      snapshot: () => {
        return { value: head };
      },
      arbitrate: (command) => {
        return { command };
      }
    },
    {
      append: (input) => Ok(record(input))
    },
    {
      reader: {
        get: (_assetId, version) => log.find(
          (event) => event.eventVersion === version
        ),
        list: (_assetId, from = 0) => log.filter(
          (event) => event.eventVersion > from
        ),
        listAll: () => [],
        listFromCheckpoints: () => []
      },
      ...options
    }
  );
  const { context } = recordingRoom();

  function connect(
    clientId: string,
    resume?: unknown
  ): { received: unknown[]; connected: Promise<void>; } {
    const handle = recordingClient(clientId);

    return {
      received: handle.received,
      connected: extension.onClientConnect(
        handle,
        roomPeer(clientId, resume),
        context
      )
    };
  }

  function send(
    clientId: string,
    seq: number
  ): void {
    extension.onMessage(clientId, { action: "increment", seq }, context);
  }

  return {
    extension,
    record,
    compact,
    connect,
    send
  };
}
