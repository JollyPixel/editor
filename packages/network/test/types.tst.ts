// Import Third-party Dependencies
import {
  describe,
  expect,
  test
} from "tstyche";
import { z } from "zod";
import * as zm from "zod/mini";

// Import Internal Dependencies
import type {
  ClientSocketEvent,
  ClientSocketEventType
} from "#src/transport/ClientSocket.ts";
import type {
  CommandBody,
  CommandReconciler,
  CommandSync,
  NetworkCommandHeader,
  NetworkServerNoticeOf
} from "#src/client/index.ts";
import {
  PresenceChannel,
  type PresenceChannelOptions
} from "#src/client/PresenceChannel.ts";
import type { Room } from "#src/client/Room.ts";
import type {
  Infer,
  JSONSchema
} from "#src/protocol/schema.ts";
import type {
  ClientEnvelope,
  ServerEnvelope
} from "#src/protocol/envelope/Envelope.ts";
import {
  MessageProtocol,
  type InferMessage
} from "#src/protocol/message/MessageProtocol.ts";
import type {
  hostWorkerDataSchema,
  mainToWorkerSchema,
  workerToMainSchema
} from "#src/server/extension/worker/protocol.schema.ts";
import type {
  HostWorkerData,
  MainToWorkerMessage,
  WorkerToMainMessage
} from "#src/server/extension/worker/protocol.ts";
import type { ChannelTransportMessage } from "#src/transport/channel/protocol.ts";

declare const room: Room;

describe("worker protocol schemas", () => {
  test("host worker data", () => {
    expect<Infer<typeof hostWorkerDataSchema>>().type.toBeAssignableTo<HostWorkerData>();
  });

  test("main to worker", () => {
    expect<Infer<typeof mainToWorkerSchema>>().type.toBeAssignableTo<MainToWorkerMessage>();
  });

  test("worker to main", () => {
    expect<Infer<typeof workerToMainSchema>>().type.toBeAssignableTo<WorkerToMainMessage>();
  });
});

type Command =
  | { action: "set"; value: number; } & NetworkCommandHeader
  | { action: "clear"; } & NetworkCommandHeader;

interface RejectedNotice {
  type: "rejected";
  reason: string;
}

interface SnapshotNotice {
  type: "snapshot";
}

interface WideNotice {
  type: string;
}

describe("NetworkServerNoticeOf", () => {
  test("accepts notices with their own type", () => {
    expect<RejectedNotice>().type.toBeAssignableTo<NetworkServerNoticeOf<RejectedNotice>>();
    expect<never>().type.toBeAssignableTo<NetworkServerNoticeOf<never>>();
  });

  test("rejects notices that may collide with a sync message type", () => {
    expect<NetworkServerNoticeOf<SnapshotNotice>>().type.toBe<never>();
    expect<NetworkServerNoticeOf<RejectedNotice | SnapshotNotice>>().type.toBe<never>();
    expect<NetworkServerNoticeOf<WideNotice>>().type.toBe<never>();
  });
});

describe("CommandBody", () => {
  test("restores the command once stamped with a header", () => {
    expect<CommandBody<Command> & NetworkCommandHeader>().type.toBeAssignableTo<Command>();
  });
});

describe("CommandReconciler", () => {
  test("takes and returns the synced command union", () => {
    type Reconciler = CommandReconciler<Command>;

    expect<Parameters<Reconciler["keys"]>[0]>().type.toBe<Command>();
    expect<ReturnType<Reconciler["narrow"]>>().type.toBe<Command | null>();
    expect<Parameters<Reconciler["revert"]>[0]>().type.toBe<readonly Command[]>();
  });

  test("send returns the stamped pending command", () => {
    expect<ReturnType<CommandSync<Command, unknown>["send"]>>().type.toBe<Command>();
  });
});

describe("ChannelTransportMessage", () => {
  test("relays every client socket event type", () => {
    expect<Extract<ChannelTransportMessage, { type: "event"; }>["event"]>()
      .type.toBe<ClientSocketEventType>();
  });

  test("relays events assignable to a client socket event", () => {
    expect<Extract<ChannelTransportMessage, { type: "event"; }>["data"]>()
      .type.toBeAssignableTo<ClientSocketEvent>();
  });
});

describe("MessageProtocol", () => {
  test("infers its message union from an inline schema", () => {
    const protocol = new MessageProtocol({
      oneOf: [
        {
          type: "object",
          properties: {
            action: { const: "voxel-removed" }
          },
          required: ["action"]
        },
        {
          type: "object",
          properties: {
            action: { const: "voxel-set" },
            x: { type: "number" }
          },
          required: [
            "action",
            "x"
          ]
        }
      ]
    });

    expect<InferMessage<typeof protocol>>().type.toBeAssignableTo<
      { action: "voxel-removed"; } | { action: "voxel-set"; x: number; }
    >();
    expect<{ action: "voxel-set"; x: number; }>()
      .type.toBeAssignableTo<InferMessage<typeof protocol>>();
  });

  test("is only built through its constructor", () => {
    expect<MessageProtocol>().type.not.toBeAssignableFrom<{
      schema: JSONSchema;
      variants: [];
      events: [];
    }>();
  });
});

describe("Envelope schemas", () => {
  test("infers every envelope kind", () => {
    expect<ClientEnvelope["kind"]>()
      .type.toBe<"join" | "leave" | "message" | "presence" | "resync">();
    expect<ServerEnvelope["kind"]>().type.toBe<
      | "message"
      | "sync"
      | "peer-joined"
      | "peer-left"
      | "peer-presence"
      | "denied"
      | "error"
    >();
  });

  test("keeps the fields spread from shared fragments required", () => {
    type PeerJoined = Extract<ServerEnvelope, { kind: "peer-joined"; }>;
    type Denied = Extract<ServerEnvelope, { kind: "denied"; }>;

    expect<Pick<PeerJoined, "room" | "clientId" | "role">>().type.toBe<{
      readonly room: string;
      readonly clientId: string;
      readonly role: string;
    }>();
    expect<Pick<Denied, "event" | "reason">>().type.toBe<{
      readonly event: string;
      readonly reason: string;
    }>();
  });
});

describe("PresenceChannel", () => {
  test("infers its value type from a zod schema", () => {
    const miniChannel = new PresenceChannel(room, {
      key: "cursor",
      decode: zm.object({ x: zm.number() })
    });
    const classicChannel = new PresenceChannel(room, {
      key: "tool",
      decode: z.string()
    });

    expect(miniChannel).type.toBe<PresenceChannel<{ x: number; }>>();
    expect(classicChannel).type.toBe<PresenceChannel<string>>();
  });

  test("rejects a schema that does not produce the value type", () => {
    expect<PresenceChannelOptions<number>>().type.not.toBeAssignableFrom({
      key: "tool",
      decode: z.string()
    });
  });
});
